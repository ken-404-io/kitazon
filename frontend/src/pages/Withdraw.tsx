import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EarningsChart from '../components/dashboard/EarningsChart';
import api from '../services/api';
import { sanitizeInput } from '../utils/sanitize';
import { UserStats, Withdrawal, WithdrawalChannel, WithdrawalStatus } from '../types';
import styles from './Withdraw.module.css';

/* ─── icons ──────────────────────────────────────────────────────────────────── */
const sz = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const BackIcon  = () => <svg {...sz}><polyline points="15 18 9 12 15 6"/></svg>;
const HistIcon  = () => <svg {...sz} width={16} height={16}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const AlertIcon = () => <svg {...sz} width={16} height={16}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const CheckIcon = () => <svg {...sz} width={14} height={14}><polyline points="20 6 9 17 4 12"/></svg>;

/* ─── config ─────────────────────────────────────────────────────────────────── */
const CHANNELS: { value: WithdrawalChannel; label: string; sub: string }[] = [
  { value: 'gcash',     label: 'GCash',     sub: '~1 hour'   },
  { value: 'maya',      label: 'Maya',      sub: '~1 hour'   },
  { value: 'gotyme',    label: 'GoTyme',    sub: '1–24 hrs'  },
  { value: 'bpi',       label: 'BPI',       sub: '1–24 hrs'  },
  { value: 'bdo',       label: 'BDO',       sub: '1–24 hrs'  },
  { value: 'unionbank', label: 'UnionBank', sub: '1–24 hrs'  },
  { value: 'coins',     label: 'Coins.ph',  sub: '1–24 hrs'  },
  { value: 'usdt',      label: 'USDT',      sub: '1–24 hrs'  },
];

const PRESETS = [50, 100, 200, 500, 1000, 2000];

const STATUS_COLOR: Record<WithdrawalStatus, string> = {
  pending:    'var(--primary-amber)',
  processing: 'var(--primary)',
  completed:  '#22c55e',
  failed:     'var(--red)',
};

type View = 'overview' | 'form' | 'history';

export default function Withdraw() {
  const { user }        = useAuth();
  const { showToast }   = useToast();
  const [view,      setView]      = useState<View>('overview');
  const [stats,     setStats]     = useState<UserStats | null>(null);
  const [history,   setHistory]   = useState<Withdrawal[]>([]);
  const [channel,   setChannel]   = useState<WithdrawalChannel>('gcash');
  const [preset,    setPreset]    = useState<number | null>(null);
  const [customAmt, setCustomAmt] = useState('');
  const [account,   setAccount]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [showOtp,   setShowOtp]   = useState(false);
  const [otp,       setOtp]       = useState('');
  const [otpErr,    setOtpErr]    = useState('');
  const [otpLoad,   setOtpLoad]   = useState(false);

  const loadData = () => {
    api.get<UserStats>('/auth/me/stats').then(r => setStats(r.data)).catch(() => {});
    api.get<Withdrawal[]>('/withdrawals').then(r => setHistory(r.data)).catch(() => {});
  };
  useEffect(() => { loadData(); }, []);

  const balance    = Number(stats?.balance ?? 0);
  const todayAmt   = Number(stats?.today   ?? 0);
  const weekAmt    = Number(stats?.week    ?? 0);
  const totalAmt   = Number(stats?.total   ?? 0);
  const amount     = preset ?? (parseFloat(customAmt) || 0);
  const emailOk    = user?.email_verified ?? false;

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const acct = sanitizeInput(account);
    if (!acct)           return setError('Account / wallet number is required.');
    if (amount < 50)     return setError('Minimum withdrawal is ₱50.');
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
    setOtpErr('');
    setOtpLoad(true);
    try {
      await api.post('/withdrawals', { amount: String(amount), channel, account_number: sanitizeInput(account), otp });
      setShowOtp(false);
      setPreset(null); setCustomAmt(''); setAccount(''); setOtp('');
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

        {/* Header */}
        <div className={styles.pageHeader}>
          <span style={{ width: 38 }} />
          <span className={styles.pageTitle}>Withdraw Money</span>
          <button className={styles.iconBtn} onClick={() => setView('history')}><HistIcon /></button>
        </div>

        {/* Hero balance */}
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>Current Balance</p>
          <p className={styles.heroBalance}>₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div>
            <span className={styles.heroDelta}>+₱{weekAmt.toFixed(2)} this week</span>
          </div>
          <button className={styles.withdrawBtn} onClick={() => setView('form')}>
            Fast Cash →
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

        {/* Total strip */}
        <div className={styles.totalStrip}>
          Total Lifetime Earnings — <strong>₱{totalAmt.toFixed(2)}</strong>
        </div>

        {/* 7-day chart */}
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>7 Day Earnings</span>
          <Link to="/dashboard" className={styles.sectionLink}>Revenue Analysis →</Link>
        </div>
        <EarningsChart />

        {/* Recent withdrawals (3 max) */}
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
                    <p className={styles.historyChannel}>{w.channel.toUpperCase()}</p>
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
                  <p className={styles.historyChannel}>{w.channel.toUpperCase()}</p>
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

        {/* Header */}
        <div className={styles.pageHeader}>
          <button className={styles.iconBtn} onClick={() => setView('overview')}><BackIcon /></button>
          <span className={styles.pageTitle}>Request Withdrawal</span>
          <button className={styles.iconBtn} onClick={() => setView('history')}><HistIcon /></button>
        </div>

        {/* Email not verified banner */}
        {!emailOk && (
          <div className={styles.alertBanner}>
            <AlertIcon />
            Email not verified. Withdrawals are disabled. Please verify your email in Account Settings.
          </div>
        )}

        {/* Balance + History */}
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

            {/* Payment method */}
            <div className={styles.sectionCard}>
              <h4>Payment Method</h4>
              <div className={styles.channelGrid}>
                {CHANNELS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`${styles.channelChip} ${channel === c.value ? styles.channelChipActive : ''}`}
                    onClick={() => setChannel(c.value)}
                  >
                    <span className={`${styles.channelDot} ${channel === c.value ? styles.channelDotFilled : ''}`} />
                    <span>
                      {c.label}
                      <span className={styles.channelSub}>{c.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Account number */}
            <div className={styles.sectionCard}>
              <h4>Account / Wallet Number</h4>
              <input
                type="text"
                value={account}
                onChange={e => setAccount(e.target.value)}
                placeholder={channel === 'usdt' ? 'TRC-20 wallet address' : '09XXXXXXXXX or account number'}
                maxLength={60}
                autoComplete="off"
                required
              />
            </div>

            {/* Amount selection */}
            <div className={styles.sectionCard}>
              <h4>Amount (min ₱50)</h4>
              <div className={styles.presetGrid}>
                {PRESETS.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.presetBtn} ${preset === p ? styles.presetBtnActive : ''}`}
                    onClick={() => { setPreset(p); setCustomAmt(''); }}
                  >
                    ₱{p.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="50"
                max="50000"
                value={customAmt}
                onChange={e => { setCustomAmt(e.target.value); setPreset(null); }}
                placeholder="Or enter custom amount"
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Zero fee on first ₱500/month · ₱5 flat fee after
              </p>
            </div>

            {error && <p className="error-msg" style={{ marginBottom: '0.75rem' }}>{error}</p>}

            <button
              className={styles.withdrawBtn}
              type="submit"
              disabled={loading || !emailOk}
            >
              {loading ? 'Sending OTP…' : `Fast Cash${amount >= 50 ? ' — ₱' + amount.toLocaleString() : ''}`}
            </button>

          </form>
        ) : null}

      </div>

      {/* OTP bottom sheet */}
      {showOtp && (
        <div className={styles.modalOverlay} onClick={() => setShowOtp(false)}>
          <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Confirm Withdrawal</p>
            <p className={styles.modalSub}>Enter the 6-digit OTP sent to your email to confirm ₱{amount.toLocaleString()} via {channel.toUpperCase()}.</p>
            <div className="form-group">
              <label>OTP Code</label>
              <input
                className={styles.otpInput}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="······"
                value={otp}
                onChange={e => setOtp(e.target.value)}
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
