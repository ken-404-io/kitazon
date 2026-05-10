import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EarningsChart from '../components/dashboard/EarningsChart';
import api from '../services/api';
import { sanitizeInput, isValidEmail } from '../utils/sanitize';
import { UserStats, Withdrawal, WithdrawalStatus, UserPlan } from '../types';
import styles from './Withdraw.module.css';

/* ─── icons ──────────────────────────────────────────────────────────────────── */
const sz = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const BackIcon  = () => <svg {...sz}><polyline points="15 18 9 12 15 6"/></svg>;
const HistIcon  = () => <svg {...sz} width={16} height={16}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const AlertIcon = () => <svg {...sz} width={16} height={16}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const CheckIcon = () => <svg {...sz} width={14} height={14}><polyline points="20 6 9 17 4 12"/></svg>;
const LockIcon  = () => <svg {...sz} width={16} height={16}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;

/* ─── plan config ────────────────────────────────────────────────────────────── */
const PLAN_CONFIG: Record<UserPlan, { name: string; color: string; dailyLimit: number; badge: string; presets: number[] | null }> = {
  free:    { name: 'Free',    color: 'var(--text-muted)', badge: '🆓', dailyLimit: 5,   presets: null },
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
  account_age_days: number;
  account_age_required: number;
  hours_remaining: number;
  tasks_completed: number;
  tasks_required: number;
  email_verified: boolean;
  is_first_withdrawal: boolean;
  reasons: string[];
}

export default function Withdraw() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const [view,      setView]      = useState<View>('overview');
  const [stats,     setStats]     = useState<UserStats | null>(null);
  const [history,   setHistory]   = useState<Withdrawal[]>([]);
  const [elig,      setElig]      = useState<Eligibility | null>(null);
  const [preset,    setPreset]    = useState<number | null>(null);
  const [account,   setAccount]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [showOtp,   setShowOtp]   = useState(false);
  const [otp,       setOtp]       = useState('');
  const [otpErr,    setOtpErr]    = useState('');
  const [otpLoad,   setOtpLoad]   = useState(false);
  const [acctTouched, setAcctTouched] = useState(false);

  const loadData = () => {
    api.get<UserStats>('/auth/me/stats').then(r => setStats(r.data)).catch(() => {});
    api.get<Withdrawal[]>('/withdrawals').then(r => setHistory(r.data)).catch(() => {});
    api.get<Eligibility>('/withdrawals/eligibility').then(r => setElig(r.data)).catch(() => {});
  };
  useEffect(() => { loadData(); }, []);

  const plan        = user?.plan ?? 'free';
  const planCfg     = PLAN_CONFIG[plan];
  const balance     = Number(stats?.balance ?? 0);
  const todayAmt    = Number(stats?.today   ?? 0);
  const weekAmt     = Number(stats?.week    ?? 0);
  const totalAmt    = Number(stats?.total   ?? 0);
  const emailOk     = user?.email_verified ?? false;

  // Free plan: fixed ₱5. VIP plans: chosen preset (default to dailyLimit).
  const amount = plan === 'free' ? 5 : (preset ?? planCfg.dailyLimit);

  const validateAccount = (val: string): string | null => {
    if (!val.trim()) return 'PayPal email address is required.';
    if (!isValidEmail(val.trim())) return 'Enter a valid PayPal email address.';
    return null;
  };

  const acctErr = acctTouched ? validateAccount(account) : null;

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAcctTouched(true);
    if (validateAccount(account)) return;
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
      await api.post('/withdrawals', { amount: String(amount), channel: 'paypal', account_number: sanitizeInput(account), otp });
      setShowOtp(false);
      setPreset(null); setAccount(''); setOtp('');
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
          {plan === 'free' && <Link to="/plans" className={styles.upgradeLink}>Upgrade →</Link>}
        </div>

        {/* ── Withdrawal requirements checklist ── */}
        {elig && !elig.eligible && (
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

              {/* Account age */}
              <div className={`${styles.reqRow} ${elig.account_age_days >= elig.account_age_required ? styles.reqDone : styles.reqPending}`}>
                <span className={styles.reqIcon}>
                  {elig.account_age_days >= elig.account_age_required
                    ? <CheckIcon />
                    : <span className={styles.reqNum}>2</span>}
                </span>
                <div className={styles.reqText}>
                  <span>Account must be {elig.account_age_required} days old</span>
                  {elig.account_age_days < elig.account_age_required
                    ? <span className={styles.reqSub}>{elig.hours_remaining}h remaining · Account is {elig.account_age_days.toFixed(1)} days old</span>
                    : <span className={styles.reqSub}>Account is {elig.account_age_days.toFixed(1)} days old</span>}
                </div>
                {elig.account_age_days >= elig.account_age_required
                  ? <span className={styles.reqBadge}>Done</span>
                  : <span className={styles.reqCountdown}>{elig.hours_remaining}h left</span>}
              </div>

              {/* Tasks completed */}
              <div className={`${styles.reqRow} ${elig.tasks_completed >= elig.tasks_required ? styles.reqDone : styles.reqPending}`}>
                <span className={styles.reqIcon}>
                  {elig.tasks_completed >= elig.tasks_required
                    ? <CheckIcon />
                    : <span className={styles.reqNum}>3</span>}
                </span>
                <div className={styles.reqText}>
                  <span>Complete {elig.tasks_required} tasks</span>
                  <span className={styles.reqSub}>{elig.tasks_completed} of {elig.tasks_required} completed</span>
                </div>
                <div className={styles.reqProgress}>
                  <div className={styles.reqBar}>
                    <div className={styles.reqBarFill} style={{ width: `${Math.min(100, (elig.tasks_completed / elig.tasks_required) * 100)}%` }} />
                  </div>
                  <span className={styles.reqProgressLabel}>{elig.tasks_completed}/{elig.tasks_required}</span>
                </div>
              </div>

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

        {/* Hero balance */}
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>Current Balance</p>
          <p className={styles.heroBalance}>₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div>
            <span className={styles.heroDelta}>+₱{weekAmt.toFixed(2)} this week</span>
          </div>
          <button
            className={styles.withdrawBtn}
            onClick={() => setView('form')}
            disabled={elig !== null && !elig.eligible}
            style={elig !== null && !elig.eligible ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          >
            {elig !== null && !elig.eligible ? '🔒 Locked' : 'Fast Cash →'}
          </button>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <p className={styles.statVal}>₱{todayAmt.toFixed(2)}</p>
            <p className={styles.statLabel}>Earned Today</p>
          </div>
          <div className={styles.statBox}>
            <p className={styles.statVal}>₱{weekAmt.toFixed(2)}</p>
            <p className={styles.statLabel}>This Week</p>
          </div>
        </div>

        <div className={styles.totalStrip}>
          Total Lifetime Earnings — <strong>₱{totalAmt.toFixed(2)}</strong>
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
                    <p className={styles.historyChannel}>PayPal</p>
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
                  <p className={styles.historyChannel}>PayPal</p>
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
  return (
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

            {/* Payment method — PayPal only */}
            <div className={styles.sectionCard}>
              <h4>Payment Method</h4>
              <div className={styles.paypalBadge}>
                <span className={styles.channelDotFilled} style={{ width: 10, height: 10, borderRadius: '50%', background: '#003087', display: 'inline-block' }} />
                <span style={{ fontWeight: 700 }}>PayPal</span>
                <span className={styles.channelSub} style={{ display: 'inline', marginLeft: 6 }}>1–24 hrs</span>
              </div>
            </div>

            {/* PayPal email */}
            <div className={styles.sectionCard}>
              <h4>PayPal Email Address</h4>
              <input
                type="email"
                value={account}
                onChange={e => { setAccount(e.target.value); setAcctTouched(false); }}
                onBlur={() => setAcctTouched(true)}
                className={acctTouched ? (acctErr ? 'field-invalid' : 'field-valid') : ''}
                placeholder="yourname@email.com"
                maxLength={80}
                autoComplete="email"
                required
              />
              {acctErr && <p className="field-hint hint-invalid">{acctErr}</p>}
            </div>

            {/* Amount selection */}
            <div className={styles.sectionCard}>
              <h4>
                Withdrawal Amount
                <span style={{ color: planCfg.color, marginLeft: 8, fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
                  {planCfg.badge} {planCfg.name}
                </span>
              </h4>

              {plan === 'free' ? (
                /* Free plan — locked */
                <div className={styles.lockedAmount}>
                  <LockIcon />
                  <div>
                    <p className={styles.lockedValue}>₱5.00 / day</p>
                    <p className={styles.lockedNote}>
                      Free plan is fixed at ₱5/day.{' '}
                      <Link to="/plans" style={{ color: 'var(--primary)' }}>Upgrade your plan</Link>
                      {' '}to withdraw more.
                    </p>
                  </div>
                </div>
              ) : (
                /* VIP plan — choose from presets */
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
            <p className={styles.modalSub}>Enter the 6-digit OTP sent to your email to confirm ₱{amount} via PayPal.</p>
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
  );
}
