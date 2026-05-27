import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import KycGate from '../components/KycGate';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EarningsChart from '../components/dashboard/EarningsChart';
import { Skeleton } from '../components/ui/Skeleton';
import api from '../services/api';
import { sanitizeInput } from '../utils/sanitize';
import { UserStats, Withdrawal, WithdrawalStatus, UserPlan } from '../types';
import styles from './Withdraw.module.css';

/* ─── icons ──────────────────────────────────────────────────────────────────── */
const sz = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const BackIcon   = () => <svg {...sz}><polyline points="15 18 9 12 15 6"/></svg>;
const HistIcon   = () => <svg {...sz} width={16} height={16}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const AlertIcon  = () => <svg {...sz} width={16} height={16}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const CheckIcon  = () => <svg {...sz} width={14} height={14}><polyline points="20 6 9 17 4 12"/></svg>;
const LockIcon   = () => <svg {...sz} width={16} height={16}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const ClockIcon  = () => <svg {...sz} width={20} height={20}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const LockIcon2  = () => <svg {...sz} width={20} height={20}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;

/* ─── plan config ────────────────────────────────────────────────────────────── */
const PLAN_CONFIG: Record<UserPlan, { name: string; color: string; dailyLimit: number; badge: string; presets: number[] | null }> = {
  free:    { name: 'Free',    color: 'var(--text-muted)', badge: '🆓', dailyLimit: 5,   presets: null },
  bronze:  { name: 'Bronze',  color: '#cd7f32',           badge: '🥉', dailyLimit: 5,   presets: null },
  silver:  { name: 'Silver',  color: '#9ca3af',           badge: '🥈', dailyLimit: 20,  presets: [5, 10, 15, 20] },
  gold:    { name: 'Gold',    color: 'var(--gold)',        badge: '🥇', dailyLimit: 50,  presets: [10, 20, 30, 50] },
  diamond: { name: 'Diamond', color: '#60a5fa',            badge: '💎', dailyLimit: 100, presets: [20, 50, 75, 100] },
};

const STATUS_COLOR: Record<WithdrawalStatus, string> = {
  pending:    'var(--primary-amber)',
  processing: 'var(--primary)',
  completed:  '#22c55e',
  failed:     'var(--red)',
};

type View = 'overview' | 'form' | 'history';

interface Eligibility {
  eligible: boolean;
  email_verified: boolean;
  has_pending_withdrawal?: boolean;
  is_first_withdrawal: boolean;
  withdrawal_credits: number;
  quizzes_completed?: number;
  quizzes_required?: number;
  quiz_gate_frozen?: boolean;
  referrals_completed?: number;
  referrals_required?: number;
  referral_gate_frozen?: boolean;
  cooldown_active?: boolean;
  cooldown_ends_at?: string | null;
  free_plan_cap_reached?: boolean;
  free_plan_total_withdrawn?: number;
  free_plan_cap?: number;
  reasons: string[];
}

function useCooldownTimer(endsAt: string | null | undefined): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!endsAt) { setLabel(''); return; }
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setLabel('Ready'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return label;
}

export default function Withdraw() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const [view,      setView]      = useState<View>((searchParams.get('view') as View) ?? 'overview');
  const [stats,     setStats]     = useState<UserStats | null>(null);
  const [history,   setHistory]   = useState<Withdrawal[]>([]);
  const [elig,      setElig]      = useState<Eligibility | null>(null);
  const [convertAmt, setConvertAmt] = useState('');
  const [converting, setConverting] = useState(false);
  const [preset,    setPreset]    = useState<number | null>(null);
  const [account,     setAccount]     = useState('');
  const [accountName, setAccountName] = useState('');
  const [savedAcct,   setSavedAcct]   = useState<string | null>(null);
  const [savedAcctName, setSavedAcctName] = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showOtp,     setShowOtp]     = useState(false);
  const [otp,         setOtp]         = useState('');
  const [otpErr,      setOtpErr]      = useState('');
  const [otpLoad,     setOtpLoad]     = useState(false);
  const [acctTouched, setAcctTouched] = useState(false);
  const [acctNameTouched, setAcctNameTouched] = useState(false);


  const loadData = () => {
    api.get<UserStats>('/auth/me/stats').then(r => setStats(r.data)).catch(() => {});
    api.get<Withdrawal[]>('/withdrawals').then(r => setHistory(r.data)).catch(() => {});
    api.get<Eligibility>('/withdrawals/eligibility').then(r => setElig(r.data)).catch(() => {});
    api.get<{ account_number: string; account_name?: string | null } | null>('/withdrawals/saved-account').then(r => {
      if (r.data) {
        setSavedAcct(r.data.account_number);
        setAccount(r.data.account_number);
        setSavedAcctName(r.data.account_name ?? null);
        if (r.data.account_name) setAccountName(r.data.account_name);
      }
    }).catch(() => {});
  };
  useEffect(() => { loadData(); }, []);

  const plan        = user?.plan ?? 'free';
  const planCfg     = PLAN_CONFIG[plan];
  const balance     = Number(stats?.balance ?? 0);
  const todayAmt    = Number(stats?.today   ?? 0);
  const weekAmt     = Number(stats?.week    ?? 0);
  const totalAmt    = Number(stats?.total   ?? 0);
  const emailOk     = user?.email_verified ?? false;
  const cooldownLabel = useCooldownTimer(elig?.cooldown_ends_at);

  // Free/Bronze plan: fixed ₱5. VIP plans: chosen preset (default to dailyLimit).
  const amount = (plan === 'free' || plan === 'bronze') ? 5 : (preset ?? planCfg.dailyLimit);

  // Philippine mobile: 11 digits starting with 09 (e.g. 09171234567)
  // Also accept +63 prefix.
  const validateAccount = (val: string): string | null => {
    const digits = val.replace(/[^\d+]/g, '');
    const normalized = digits.startsWith('+63') && digits.length === 13 ? '0' + digits.slice(3) : digits;
    if (!normalized) return 'GCash mobile number is required.';
    if (!/^09\d{9}$/.test(normalized)) return 'Enter a valid GCash number (11 digits starting with 09).';
    return null;
  };

  const acctErr = acctTouched ? validateAccount(account) : null;

  // Account name: required. Reject PayPal and any email-shaped value.
  const validateAccountName = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'GCash account name is required.';
    if (trimmed.length < 2) return 'Account name is too short.';
    if (/@/.test(trimmed) || /\S+@\S+\.\S+/.test(trimmed)) {
      return 'Account name cannot be an email. Enter the full name on your GCash account.';
    }
    if (/paypal/i.test(trimmed)) {
      return 'PayPal is not supported. Withdrawals are GCash-only.';
    }
    return null;
  };
  const acctNameErr = acctNameTouched ? validateAccountName(accountName) : null;

  const creditInput  = Math.max(0, Math.floor(Number(convertAmt) || 0));
  const phpToSpend   = creditInput * 25;

  const convertCredits = async () => {
    if (creditInput < 1) return;
    setConverting(true);
    try {
      const res = await api.post<{ credits: number; balance: number; message: string }>('/credits/convert', { amount: phpToSpend, credits: creditInput });
      showToast(res.data.message, 'success');
      setConvertAmt('');
      loadData();
    } catch (err: unknown) {
      showToast((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Conversion failed.', 'error');
    } finally { setConverting(false); }
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAcctTouched(true);
    setAcctNameTouched(true);
    if (validateAccount(account)) return;
    if (validateAccountName(accountName)) return;
    if (amount > balance) return setError('Insufficient balance.');
    setLoading(true);
    try {
      await api.post('/withdrawals/request-otp', { amount: String(amount) });
      setShowOtp(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  const confirmWithdrawal = async () => {
    if (otpLoad) return;
    setOtpErr('');
    setOtpLoad(true);
    try {
      await api.post('/withdrawals', {
        amount: String(amount),
        channel: 'gcash',
        account_number: sanitizeInput(account),
        account_name: sanitizeInput(accountName.trim()),
        otp,
      });
      setShowOtp(false);
      setPreset(null); setAccount(''); setAccountName(''); setOtp('');
      setView('overview');
      loadData();
      showToast('Withdrawal submitted successfully!', 'success');
    } catch (err: unknown) {
      setOtpErr((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Invalid OTP.');
    } finally { setOtpLoad(false); }
  };

  /* ══════════════════════════ OVERVIEW ════════════════════════════════════════ */
  if (view === 'overview') return (
    <div className="page-container">
      <div className={styles.page}>

        <div className={styles.pageHeader}>
          <span style={{ width: 38 }} />
          <span className={styles.pageTitle}>Withdraw Money</span>
          <button className={styles.iconBtn} onClick={() => setView('history')}><HistIcon /></button>
        </div>

        {/* Plan badge */}
        <div className={styles.planBadge} style={{ borderColor: planCfg.color }}>
          <span>{planCfg.badge}</span>
          <span style={{ fontWeight: 700, color: planCfg.color }}>{planCfg.name} Plan</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>· ₱{planCfg.dailyLimit}/day limit</span>
          {(plan === 'free' || plan === 'bronze') && <Link to="/plans" className={styles.upgradeLink}>Upgrade →</Link>}
        </div>

        {/* ── 24h cooldown banner ── */}
        {elig?.cooldown_active && elig.cooldown_ends_at && (
          <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 14, padding: '1rem 1.1rem', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: 14, opacity: 0.8 }}>
            <span style={{ flexShrink: 0, color: 'var(--text-muted)' }}><ClockIcon /></span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Come back tomorrow</p>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>One withdrawal per day · available in <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text)' }}>{cooldownLabel}</span></p>
            </div>
          </div>
        )}

        {/* ── Free plan ₱5 cap banner ── */}
        {elig?.free_plan_cap_reached && (
          <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 14, padding: '1rem 1.1rem', marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ flexShrink: 0, color: 'var(--text-muted)', marginTop: 2 }}><LockIcon2 /></span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Free plan limit reached</p>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  You've used ₱{Number(elig.free_plan_total_withdrawn ?? 0).toFixed(2)} of your ₱{elig.free_plan_cap ?? 5} free plan allowance. Upgrade to a paid plan to keep withdrawing.
                </p>
              </div>
            </div>
            <Link to="/plans" style={{ display: 'block', marginTop: '0.75rem', textAlign: 'center', background: 'var(--gold)', color: '#000', fontWeight: 800, fontSize: '0.88rem', padding: '0.65rem', borderRadius: 10, textDecoration: 'none' }}>
              Upgrade Plan →
            </Link>
          </div>
        )}

        {/* ── Withdrawal requirements checklist ── */}
        {elig && !elig.eligible && !elig.cooldown_active && !elig.free_plan_cap_reached && (
          <div className={styles.requirementsCard}>
            <p className={styles.reqTitle}>
              <LockIcon /> Complete these steps to unlock withdrawals
            </p>
            <div className={styles.reqList}>

              {/* Email verification */}
              <div className={`${styles.reqRow} ${elig.email_verified ? styles.reqDone : styles.reqPending}`}>
                <span className={styles.reqIcon}>{elig.email_verified ? <CheckIcon /> : <span className={styles.reqNum}>1</span>}</span>
                <div className={styles.reqText}>
                  <span>Verify your email</span>
                  {!elig.email_verified && <span className={styles.reqSub}>Check your inbox for the verification link</span>}
                </div>
                {elig.email_verified && <span className={styles.reqBadge}>Done</span>}
              </div>

              {/* Withdrawal credits */}
              <div className={`${styles.reqRow} ${elig.withdrawal_credits >= 5 ? styles.reqDone : styles.reqPending}`}>
                <span className={styles.reqIcon}>{elig.withdrawal_credits >= 5 ? <CheckIcon /> : <span className={styles.reqNum}>2</span>}</span>
                <div className={styles.reqText}>
                  <span>Have withdrawal credits</span>
                  <span className={styles.reqSub}>You have {elig.withdrawal_credits} credit{elig.withdrawal_credits !== 1 ? 's' : ''} · earn via daily check-in or convert ₱25 → 1 credit</span>
                </div>
                {elig.withdrawal_credits >= 5
                  ? <span className={styles.reqBadge}>Done</span>
                  : <span className={styles.reqCountdown}>{elig.withdrawal_credits} credits</span>}
              </div>

              {/* Math-quiz gate */}
              {elig.quizzes_required !== undefined && (() => {
                const frozen = elig.quiz_gate_frozen ?? false;
                const done   = elig.quizzes_completed ?? 0;
                const need   = elig.quizzes_required ?? 35;
                const met    = !frozen && done >= need;
                return (
                  <div className={`${styles.reqRow} ${met ? styles.reqDone : styles.reqPending}`}>
                    <span className={styles.reqIcon}>{met ? <CheckIcon /> : <span className={styles.reqNum}>3</span>}</span>
                    <div className={styles.reqText}>
                      <span>Answer {need} math quiz questions</span>
                      <span className={styles.reqSub}>
                        {frozen
                          ? 'Quiz gate starts after your pending withdrawal is completed · each correct answer = ₱3'
                          : `${done}/${need} answered since your last completed withdrawal · each correct answer = ₱3`}
                      </span>
                    </div>
                    {met
                      ? <span className={styles.reqBadge}>Done</span>
                      : <Link to="/quiz" className={styles.reqCountdown} style={{ textDecoration: 'none' }}>Play Quiz →</Link>}
                  </div>
                );
              })()}

              {/* Referral gate */}
              {(() => {
                const frozen = elig.referral_gate_frozen ?? false;
                const done   = elig.referrals_completed ?? 0;
                const need   = elig.referrals_required ?? 2;
                const met    = !frozen && done >= need;
                return (
                  <div className={`${styles.reqRow} ${met ? styles.reqDone : styles.reqPending}`}>
                    <span className={styles.reqIcon}>{met ? <CheckIcon /> : <span className={styles.reqNum}>4</span>}</span>
                    <div className={styles.reqText}>
                      <span>Invite {need} friends</span>
                      <span className={styles.reqSub}>
                        {frozen
                          ? 'Invite gate resets after your pending withdrawal is completed'
                          : `${done}/${need} invited since your last withdrawal`}
                      </span>
                    </div>
                    {met
                      ? <span className={styles.reqBadge}>Done</span>
                      : <Link to="/referral" className={styles.reqCountdown} style={{ textDecoration: 'none' }}>Invite →</Link>}
                  </div>
                );
              })()}

            </div>
            <Link to="/tasks" className={styles.reqCta}>Go to Tasks →</Link>
          </div>
        )}

        {/* First-withdrawal notice (shown even when eligible) */}
        {elig?.eligible && elig.is_first_withdrawal && (
          <div className={styles.firstWithdrawNotice}>
            <AlertIcon />
            <div>
              <strong>First withdrawal is reviewed by our team</strong>
              <p>This is a one-time check. After approval, all future withdrawals are processed automatically.</p>
            </div>
          </div>
        )}

        {/* ── Balance + Credits side-by-side cards ── */}
        <div className={styles.balanceRow}>
          <div className={styles.balanceCard}>
            <div className={styles.balanceCardIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
            <p className={styles.balanceCardLabel}>Total Balance</p>
            {stats === null
              ? <Skeleton height={28} width={90} style={{ marginTop: 4 }} />
              : <p className={styles.balanceCardVal}>₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
          </div>

          <div className={`${styles.balanceCard} ${styles.creditsBalCard}`}>
            <div className={styles.balanceCardIcon} style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9.5a3.5 3.5 0 1 0-3 5.5"/>
                <line x1="12" y1="17" x2="12" y2="17.5"/>
              </svg>
            </div>
            <p className={styles.balanceCardLabel}>Credits Available</p>
            {elig === null
              ? <Skeleton height={28} width={60} style={{ marginTop: 4 }} />
              : <p className={styles.balanceCardVal} style={{ color: '#60a5fa' }}>{(elig?.withdrawal_credits ?? 0).toLocaleString()}</p>}
          </div>
        </div>

        <button
          className={styles.withdrawBtn}
          onClick={() => setView('form')}
          disabled={elig !== null && !elig.eligible}
          style={elig !== null && !elig.eligible ? { opacity: 0.55, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 } : { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {elig?.has_pending_withdrawal ? (
            <><ClockIcon />Withdrawal Pending…</>
          ) : elig?.cooldown_active ? (
            <><ClockIcon />Come back tomorrow · {cooldownLabel}</>
          ) : elig?.free_plan_cap_reached ? (
            <><LockIcon2 />Upgrade to Withdraw</>
          ) : (elig !== null && !elig.eligible) ? (
            <><ClockIcon />Come back tomorrow</>
          ) : (
            'Fast Cash →'
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate('/change-withdrawal-method')}
          style={{
            width: '100%',
            marginTop: 10,
            background: 'transparent',
            border: '1.5px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 10,
            padding: '0.7rem 1rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Change Withdrawal Method →
        </button>

        <div className={styles.totalStrip}>
          Total Lifetime Earnings — {stats === null
            ? <Skeleton height={14} width={70} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
            : <strong>₱{totalAmt.toFixed(2)}</strong>}
        </div>

        {/* ── Withdrawal Credits convert card ── */}
        <div className={styles.creditsCard}>
          <div className={styles.creditsHeader}>
            <div className={styles.creditsInfo}>
              <span className={styles.creditsIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M15 9.5a3.5 3.5 0 1 0-3 5.5"/>
                </svg>
              </span>
              <div>
                <p className={styles.creditsTitle}>Get Withdrawal Credits</p>
                <p className={styles.creditsSub}>Enter how many credits you want · 1 credit costs ₱25 · +1 credit per daily check-in</p>
              </div>
            </div>
          </div>

          <div className={styles.convertRow}>
            <div className={styles.convertInput}>
              <span className={styles.convertPrefix}>CR</span>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 5"
                value={convertAmt}
                onChange={e => setConvertAmt(e.target.value)}
                className={styles.convertField}
              />
            </div>
            <button
              className="btn-primary"
              style={{ fontSize: 13, padding: '0.55rem 1rem', whiteSpace: 'nowrap' }}
              disabled={converting || creditInput < 1 || phpToSpend > balance}
              onClick={convertCredits}
            >
              {converting ? 'Converting…' : 'Convert → Credits'}
            </button>
          </div>
          <p className={styles.convertHint}>
            {creditInput > 0 ? `${creditInput} credit${creditInput !== 1 ? 's' : ''}` : '0 credits'} = <strong>₱{phpToSpend.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
            {creditInput > 0 && phpToSpend > balance ? <span style={{ color: 'var(--red)' }}> · Insufficient balance</span> : null}
          </p>
        </div>

        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>7 Day Earnings</span>
          <Link to="/dashboard" className={styles.sectionLink}>Revenue Analysis →</Link>
        </div>
        <EarningsChart />

        {history.length > 0 && (
          <>
            <div className={styles.sectionHeader} style={{ marginTop: '1.25rem' }}>
              <span className={styles.sectionTitle}>Recent Withdrawals</span>
              <button className={styles.sectionLink} onClick={() => setView('history')}>See all →</button>
            </div>
            <div className={styles.historyCard}>
              {history.slice(0, 3).map(w => (
                <div key={w.id} className={styles.historyRow}>
                  <div className={styles.historyLeft}>
                    <p className={styles.historyChannel}>GCash</p>
                    <p className={styles.historyAccount}>{w.account_number}</p>
                    <p className={styles.historyTime}>{new Date(w.created_at).toLocaleString('en-PH')}</p>
                  </div>
                  <div className={styles.historyRight}>
                    <p className={styles.historyAmt}>₱{parseFloat(String(w.amount)).toFixed(2)}</p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[w.status] }}>{w.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );

  /* ══════════════════════════ HISTORY ══════════════════════════════════════════ */
  if (view === 'history') return (
    <div className="page-container">
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <button className={styles.iconBtn} onClick={() => setView('overview')}><BackIcon /></button>
          <span className={styles.pageTitle}>Withdrawal History</span>
          <span style={{ width: 38 }} />
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No withdrawals yet.</div>
        ) : (
          <div className={styles.historyCard}>
            {history.map(w => (
              <div key={w.id} className={styles.historyRow}>
                <div className={styles.historyLeft}>
                  <p className={styles.historyChannel}>GCash</p>
                  <p className={styles.historyAccount}>{w.account_number}</p>
                  <p className={styles.historyTime}>{new Date(w.created_at).toLocaleString('en-PH')}</p>
                </div>
                <div className={styles.historyRight}>
                  <p className={styles.historyAmt}>₱{parseFloat(String(w.amount)).toFixed(2)}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[w.status] }}>{w.status}</span>
                  <Link to={`/withdrawals/${w.id}/receipt`} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>Receipt</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* ══════════════════════════ FORM ════════════════════════════════════════════ */
  // Redirect back to overview if cooldown, cap, or pending withdrawal is blocking
  if (elig && (elig.has_pending_withdrawal || elig.cooldown_active || elig.free_plan_cap_reached)) {
    return (
      <div className="page-container">
        <div className={styles.page}>
          <div className={styles.pageHeader}>
            <button className={styles.iconBtn} onClick={() => setView('overview')}><BackIcon /></button>
            <span className={styles.pageTitle}>Request Withdrawal</span>
            <span style={{ width: 38 }} />
          </div>
          {elig.has_pending_withdrawal && (
            <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', marginTop: '1rem' }}>
              <span style={{ display: 'inline-flex', color: 'var(--primary-amber)', marginBottom: '0.75rem' }}><ClockIcon /></span>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', margin: '0 0 6px' }}>Withdrawal in Progress</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                You already have a pending withdrawal being processed. You can submit a new request once it has been completed or rejected.
              </p>
            </div>
          )}
          {elig.cooldown_active && elig.cooldown_ends_at && (
            <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', marginTop: '1rem', opacity: 0.85 }}>
              <span style={{ display: 'inline-flex', color: 'var(--text-muted)', marginBottom: '0.75rem' }}><ClockIcon /></span>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', margin: '0 0 4px' }}>Come back tomorrow</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>One withdrawal per day. Next withdrawal available in:</p>
              <p style={{ fontWeight: 700, fontSize: '1.3rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text)', margin: 0 }}>{cooldownLabel}</p>
            </div>
          )}
          {elig.free_plan_cap_reached && (
            <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', marginTop: '1rem' }}>
              <span style={{ display: 'inline-flex', color: 'var(--text-muted)', marginBottom: '0.75rem' }}><LockIcon2 /></span>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', margin: '0 0 6px' }}>Free plan limit reached</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                You've used ₱{Number(elig.free_plan_total_withdrawn ?? 0).toFixed(2)} of your ₱{elig.free_plan_cap ?? 5} free plan allowance. Upgrade to keep withdrawing.
              </p>
              <Link to="/plans" style={{ display: 'inline-block', background: 'var(--gold)', color: '#000', fontWeight: 800, fontSize: '0.9rem', padding: '0.65rem 2rem', borderRadius: 10, textDecoration: 'none' }}>
                Upgrade Plan →
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <KycGate feature="withdrawals">
    <div className="page-container">
      <div className={styles.page}>

        <div className={styles.pageHeader}>
          <button className={styles.iconBtn} onClick={() => setView('overview')}><BackIcon /></button>
          <span className={styles.pageTitle}>Request Withdrawal</span>
          <button className={styles.iconBtn} onClick={() => setView('history')}><HistIcon /></button>
        </div>

        {!emailOk && (
          <div className={styles.alertBanner}>
            <AlertIcon />
            Email not verified. Withdrawals are disabled. Please verify your email in Account Settings.
          </div>
        )}

        <div className={styles.balanceRow}>
          <div className={styles.balanceInfo}>
            <p className={styles.balanceLabel}>Current Balance</p>
            <p className={styles.balanceAmt}>₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          </div>
          <button className={styles.historyBtn} onClick={() => setView('history')}>
            <HistIcon /> History
          </button>
        </div>

        {emailOk ? (
          <form onSubmit={requestOtp}>

            {/* Payment method — GCash only */}
            <div className={styles.sectionCard}>
              <h4>Payment Method</h4>
              <div className={styles.paypalBadge}>
                <span className={styles.channelDotFilled} style={{ width: 10, height: 10, borderRadius: '50%', background: '#0070e0', display: 'inline-block' }} />
                <span style={{ fontWeight: 700 }}>GCash</span>
                <span className={styles.channelSub} style={{ display: 'inline', marginLeft: 6 }}>1–24 hrs</span>
              </div>
            </div>

            {/* GCash mobile number */}
            <div className={styles.sectionCard}>
              <h4>GCash Mobile Number</h4>
              {savedAcct ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.9rem' }}>
                    <LockIcon />
                    <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text)' }}>{savedAcct}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 20 }}>Saved</span>
                  </div>
                  <div style={{ marginTop: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    To change or remove your GCash account, please contact support. This is required to prevent duplicate accounts.
                  </div>
                </div>
              ) : (
                <input
                  type="tel"
                  inputMode="tel"
                  value={account}
                  onChange={e => { setAccount(e.target.value); setAcctTouched(false); }}
                  onBlur={() => setAcctTouched(true)}
                  className={acctTouched ? (acctErr ? 'field-invalid' : 'field-valid') : ''}
                  placeholder="09171234567"
                  maxLength={13}
                  autoComplete="tel"
                  required
                />
              )}
              {acctErr && !savedAcct && <p className="field-hint hint-invalid">{acctErr}</p>}
              {!savedAcct && (
                <p style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  ⚠️ Once used, this GCash number will be permanently linked to your profile.
                </p>
              )}
            </div>

            {/* GCash account name */}
            <div className={styles.sectionCard}>
              <h4>GCash Account Name</h4>
              {savedAcct && savedAcctName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.9rem' }}>
                  <LockIcon />
                  <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text)' }}>{savedAcctName}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 20 }}>Saved</span>
                </div>
              ) : (
                <input
                  type="text"
                  value={accountName}
                  onChange={e => { setAccountName(e.target.value); setAcctNameTouched(false); }}
                  onBlur={() => setAcctNameTouched(true)}
                  className={acctNameTouched ? (acctNameErr ? 'field-invalid' : 'field-valid') : ''}
                  placeholder="Full name on your GCash account"
                  maxLength={100}
                  autoComplete="name"
                  required
                />
              )}
              {acctNameErr && !(savedAcct && savedAcctName) && <p className="field-hint hint-invalid">{acctNameErr}</p>}
              {!(savedAcct && savedAcctName) && !acctNameErr && (
                <p style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  Must match the name registered to your GCash. PayPal and emails are not accepted.
                </p>
              )}
            </div>

            {/* Amount selection */}
            <div className={styles.sectionCard}>
              <h4>
                Withdrawal Amount
                <span style={{ color: planCfg.color, marginLeft: 8, fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
                  {planCfg.badge} {planCfg.name}
                </span>
              </h4>

              {(plan === 'free' || plan === 'bronze') ? (
                /* Free/Bronze plan — fixed ₱5 */
                <div className={styles.lockedAmount}>
                  <LockIcon />
                  <div>
                    <p className={styles.lockedValue}>₱5.00 / day</p>
                    <p className={styles.lockedNote}>
                      {plan === 'free' ? <>Free plan is fixed at ₱5/day.{' '}<Link to="/plans" style={{ color: 'var(--primary)' }}>Upgrade your plan</Link>{' '}to withdraw more.</> : 'Bronze plan is fixed at ₱5/day.'}
                    </p>
                  </div>
                </div>
              ) : (
                /* Silver/Gold/Diamond — choose from presets */
                <div className={styles.presetGrid}>
                  {planCfg.presets!.map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.presetBtn} ${amount === p ? styles.presetBtnActive : ''}`}
                      onClick={() => setPreset(p)}
                    >
                      ₱{p}
                    </button>
                  ))}
                </div>
              )}

              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10 }}>
                Daily limit: ₱{planCfg.dailyLimit} · Zero fee on first ₱500/month · ₱5 flat fee after
              </p>
            </div>

            {error && <p className="error-msg" style={{ marginBottom: '0.75rem' }}>{error}</p>}

            <button
              className={styles.withdrawBtn}
              type="submit"
              disabled={loading || !emailOk}
            >
              {loading ? 'Sending OTP…' : `Fast Cash — ₱${amount}`}
            </button>

          </form>
        ) : null}

      </div>

      {/* OTP bottom sheet */}
      {showOtp && (
        <div className={styles.modalOverlay} onClick={() => setShowOtp(false)}>
          <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Confirm Withdrawal</p>
            <p className={styles.modalSub}>Enter the 6-digit OTP sent to your email to confirm ₱{amount} via GCash.</p>
            <div className="form-group">
              <label>OTP Code</label>
              <input
                className={`${styles.otpInput} ${otp.length === 6 ? 'field-valid' : otp.length > 0 ? 'field-invalid' : ''}`}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="······"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
            </div>
            {otpErr && <p className="error-msg">{otpErr}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn-outline" style={{ flex: 1 }} type="button" onClick={() => setShowOtp(false)}>Cancel</button>
              <button className={styles.withdrawBtn} style={{ flex: 2 }} type="button" onClick={confirmWithdrawal} disabled={otpLoad || otp.length < 6}>
                {otpLoad ? 'Processing…' : <><CheckIcon /> Confirm</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </KycGate>
  );
}
