import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { isStrongPassword } from '../utils/sanitize';
import styles from './AccountSettings.module.css';

/* ─── local icons ─────────────────────────────────────────────────────────── */
const sz = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ChevronRight = () => <svg {...sz}><polyline points="9 18 15 12 9 6"/></svg>;
const ChevronLeft  = () => <svg {...sz}><polyline points="15 18 9 12 15 6"/></svg>;
const BellIcon     = () => <svg {...sz}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
const LockIcon     = () => <svg {...sz}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
const ShieldIcon   = () => <svg {...sz}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>;
const ClockIcon    = () => <svg {...sz}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const DevicesIcon  = () => <svg {...sz}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>;
const MailIcon     = () => <svg {...sz}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const MoonIcon     = () => <svg {...sz}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>;
const SunIcon      = () => <svg {...sz}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const HelpIcon     = () => <svg {...sz}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const TrashIcon    = () => <svg {...sz}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const AlertSmIcon  = () => <svg {...sz} width={14} height={14}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

/* ─── types ───────────────────────────────────────────────────────────────── */
interface TotpSetup { secret: string; qr: string; }
interface LoginEvent {
  id: number;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
type View = 'main' | 'change-password' | '2fa' | 'login-history' | 'devices' | 'notifications' | 'help' | 'delete';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function initials(name?: string) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function handle(email?: string) {
  if (!email) return '';
  return '@' + email.split('@')[0];
}

export default function AccountSettings() {
  const { user, logout, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>('main');
  const [balance, setBalance] = useState<number>(0);

  const [pwForm, setPwForm]     = useState({ current: '', next: '' });
  const [pwError, setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError]       = useState('');
  const [deleteLoading, setDeleteLoading]   = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);

  const [history, setHistory]         = useState<LoginEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [verifyMsg, setVerifyMsg]     = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [totpSetup, setTotpSetup]   = useState<TotpSetup | null>(null);
  const [totpCode, setTotpCode]     = useState('');
  const [totpMsg, setTotpMsg]       = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(user?.totp_enabled ?? false);

  useEffect(() => {
    api.get<{ balance: number }>('/auth/me/stats').then(r => setBalance(r.data.balance ?? 0)).catch(() => {});
  }, []);

  /* ── actions ─────────────────────────────────────────────────────────────── */
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    const err = isStrongPassword(pwForm.next);
    if (err) { setPwError(err); return; }
    if (pwForm.current === pwForm.next) { setPwError('New password must be different.'); return; }
    setPwLoading(true);
    try {
      const res = await api.post('/account/change-password', { current_password: pwForm.current, new_password: pwForm.next });
      setPwSuccess(res.data.message);
      setPwForm({ current: '', next: '' });
      await logout();
    } catch (err: unknown) {
      setPwError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.');
    } finally { setPwLoading(false); }
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await api.delete('/account', { data: { password: deletePassword } });
      await logout();
    } catch (err: unknown) {
      setDeleteError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.');
    } finally { setDeleteLoading(false); }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get<LoginEvent[]>('/account/login-history');
      setHistory(res.data);
    } finally { setHistoryLoading(false); }
  };

  const resendVerification = async () => {
    setVerifyLoading(true);
    try {
      const res = await api.post('/auth/resend-verification', {});
      setVerifyMsg(res.data.message);
      await refreshUser();
    } catch (err: unknown) {
      setVerifyMsg((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.');
    } finally { setVerifyLoading(false); }
  };

  /* ── sub-view wrapper ────────────────────────────────────────────────────── */
  const SubView = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className={styles.page}>
      <div className={styles.subHeader}>
        <button className={styles.backBtn} onClick={() => setView('main')}><ChevronLeft /></button>
        <span className={styles.subTitle}>{title}</span>
      </div>
      {children}
    </div>
  );

  /* ── Change Password view ─────────────────────────────────────────────────── */
  if (view === 'change-password') return (
    <div className="page-container">
      <SubView title="Change Password">
        <div className={styles.formCard}>
          <form onSubmit={changePassword}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required maxLength={128} autoComplete="current-password" />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} required maxLength={128} autoComplete="new-password" />
            </div>
            {pwError && <p className="error-msg">{pwError}</p>}
            {pwSuccess && <p className={styles.successMsg}>{pwSuccess}</p>}
            <button className="btn-primary" type="submit" disabled={pwLoading} style={{ width: '100%', marginTop: 4 }}>
              {pwLoading ? 'Saving…' : 'Change Password'}
            </button>
          </form>
        </div>
      </SubView>
    </div>
  );

  /* ── 2FA view ────────────────────────────────────────────────────────────── */
  if (view === '2fa') return (
    <div className="page-container">
      <SubView title="Two-Factor Authentication">
        <div className={styles.formCard}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {totpEnabled ? '2FA is enabled. Your account is protected.' : 'Add an extra layer of security with an authenticator app.'}
          </p>
          {!totpSetup && !totpEnabled && (
            <button className="btn-primary" disabled={totpLoading} style={{ width: '100%' }} onClick={async () => {
              setTotpLoading(true); setTotpMsg('');
              try { const r = await api.post<TotpSetup>('/totp/setup', {}); setTotpSetup(r.data); }
              catch { setTotpMsg('Failed to start setup.'); }
              finally { setTotpLoading(false); }
            }}>{totpLoading ? 'Loading…' : 'Enable 2FA'}</button>
          )}
          {totpSetup && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Scan this QR code with Google Authenticator or Authy, then enter the 6-digit code:</p>
              <div className={styles.qrWrap}>
                <img src={totpSetup.qr} alt="QR code" width={180} height={180} className={styles.qrImg} />
                <p className={styles.secretKey}>Manual key: {totpSetup.secret}</p>
              </div>
              <div className={styles.codeRow}>
                <input value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="000000" maxLength={6} />
                <button className="btn-primary" disabled={totpLoading} onClick={async () => {
                  setTotpLoading(true); setTotpMsg('');
                  try {
                    await api.post('/totp/verify', { code: totpCode });
                    setTotpSetup(null); setTotpEnabled(true); setTotpMsg('2FA enabled!');
                  } catch (err: unknown) {
                    setTotpMsg((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Invalid code.');
                  } finally { setTotpLoading(false); }
                }}>Confirm</button>
              </div>
            </div>
          )}
          {totpEnabled && (
            <div>
              <div className={styles.codeRow}>
                <input value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="Enter code to disable" maxLength={6} />
                <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={totpLoading} onClick={async () => {
                  setTotpLoading(true); setTotpMsg('');
                  try {
                    await api.post('/totp/disable', { code: totpCode });
                    setTotpEnabled(false); setTotpMsg('2FA disabled.');
                  } catch (err: unknown) {
                    setTotpMsg((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.');
                  } finally { setTotpLoading(false); }
                }}>Disable</button>
              </div>
            </div>
          )}
          {totpMsg && <p style={{ marginTop: 10, fontSize: 14, color: totpMsg.includes('!') ? 'var(--primary-amber)' : 'var(--red)' }}>{totpMsg}</p>}
        </div>
      </SubView>
    </div>
  );

  /* ── Login History view ───────────────────────────────────────────────────── */
  if (view === 'login-history') return (
    <div className="page-container">
      <SubView title="Login History">
        <div className={styles.formCard}>
          {!history ? (
            <button className="btn-outline" style={{ width: '100%' }} onClick={loadHistory} disabled={historyLoading}>
              {historyLoading ? 'Loading…' : 'Load Login History'}
            </button>
          ) : history.length === 0 ? (
            <p className={styles.placeholder}>No login history found.</p>
          ) : history.map(ev => (
            <div key={ev.id} className={styles.historyItem}>
              <div className={styles.historyLeft}>
                <p className={styles.historyTime}>{new Date(ev.created_at).toLocaleString('en-PH')}</p>
                <p className={styles.historyIp}>{ev.ip_address ?? '—'}</p>
                <p className={styles.historyDevice}>{ev.user_agent ?? '—'}</p>
              </div>
              <span className={ev.success ? styles.statusOk : styles.statusFail}>
                {ev.success ? 'Success' : 'Failed'}
              </span>
            </div>
          ))}
        </div>
      </SubView>
    </div>
  );

  /* ── Devices view ─────────────────────────────────────────────────────────── */
  if (view === 'devices') return (
    <div className="page-container">
      <SubView title="Devices">
        <div className={styles.formCard}>
          <p className={styles.placeholder}>Device management coming soon.</p>
        </div>
      </SubView>
    </div>
  );

  /* ── Notifications view ───────────────────────────────────────────────────── */
  if (view === 'notifications') return (
    <div className="page-container">
      <SubView title="Notification Preferences">
        <div className={styles.formCard}>
          <p className={styles.placeholder}>Notification settings coming soon.</p>
        </div>
      </SubView>
    </div>
  );

  /* ── Help view ────────────────────────────────────────────────────────────── */
  if (view === 'help') return (
    <div className="page-container">
      <SubView title="Help Center">
        <div className={styles.formCard}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Need help? Reach out and we'll get back to you.
          </p>
          <a href="mailto:support@kitazon.com" className="btn-primary" style={{ display: 'block', textAlign: 'center', borderRadius: 12 }}>
            Contact Support
          </a>
        </div>
      </SubView>
    </div>
  );

  /* ── Delete Account view ─────────────────────────────────────────────────── */
  if (view === 'delete') return (
    <div className="page-container">
      <SubView title="Delete Account">
        <div className={styles.dangerCard}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            This permanently anonymizes your account. Your earnings history is preserved for audit purposes.
          </p>
          {!confirmDelete ? (
            <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)', width: '100%' }} onClick={() => setConfirmDelete(true)}>
              Delete My Account
            </button>
          ) : (
            <form onSubmit={deleteAccount}>
              <div className="form-group">
                <label>Enter your password to confirm</label>
                <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} required maxLength={128} autoComplete="current-password" />
              </div>
              {deleteError && <p className="error-msg">{deleteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, background: 'var(--red)' }} disabled={deleteLoading}>
                  {deleteLoading ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            </form>
          )}
        </div>
      </SubView>
    </div>
  );

  /* ── Main view ───────────────────────────────────────────────────────────── */
  const emailVerified = user?.email_verified;
  const twoFaStatus   = totpEnabled ? 'Enabled' : 'Disabled';

  return (
    <div className="page-container">
      <div className={styles.page}>

        {/* Page header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Account Settings</h1>
            <p className={styles.pageSub}>Manage your account and security.</p>
          </div>
          <button className={styles.bellBtn}><BellIcon /></button>
        </div>

        {/* Profile card */}
        <div className={styles.profileCard}>
          <div className={styles.avatar}>{initials(user?.name)}</div>
          <div className={styles.profileInfo}>
            <p className={styles.profileName}>{user?.name ?? '—'}</p>
            <p className={styles.profileHandle}>{handle(user?.email)}</p>
            {!emailVerified && (
              <span className={styles.unverifiedBadge}>
                <AlertSmIcon /> Unverified email
              </span>
            )}
          </div>
          <div className={styles.profileBalance}>
            <p className={styles.balanceLabel}>Balance</p>
            <p className={styles.balanceAmt}>₱ {Number(balance).toFixed(2)}</p>
          </div>
          <span className={styles.profileChevron}><ChevronRight /></span>
        </div>

        {/* Email not verified banner */}
        {!emailVerified && (
          <div className={styles.alertBanner}>
            <div className={styles.alertIcon}><MailIcon /></div>
            <div className={styles.alertText}>
              <p className={styles.alertTitle}>Email not verified</p>
              <p className={styles.alertSub}>Withdrawals are disabled until you verify your email.</p>
              {verifyMsg && <p style={{ fontSize: 12, color: 'var(--primary-amber)', marginTop: 4 }}>{verifyMsg}</p>}
            </div>
            <button className={styles.resendBtn} onClick={resendVerification} disabled={verifyLoading}>
              {verifyLoading ? 'Sending…' : 'Resend Verification'}
            </button>
          </div>
        )}

        {/* Security section */}
        <p className={styles.sectionLabel}>Security</p>
        <div className={styles.settingsCard}>
          <div className={styles.settingRow} onClick={() => setView('change-password')}>
            <span className={styles.settingIcon}><LockIcon /></span>
            <span className={styles.settingLabel}>Change Password</span>
            <span className={styles.chevron}><ChevronRight /></span>
          </div>
          <div className={styles.settingRow} onClick={() => setView('2fa')}>
            <span className={styles.settingIcon}><ShieldIcon /></span>
            <span className={styles.settingLabel}>Two-Factor Authentication (2FA)</span>
            <span className={styles.settingValue}>{twoFaStatus}</span>
            <span className={styles.chevron}><ChevronRight /></span>
          </div>
          <div className={styles.settingRow} onClick={() => { setView('login-history'); if (!history) loadHistory(); }}>
            <span className={styles.settingIcon}><ClockIcon /></span>
            <span className={styles.settingLabel}>Login History</span>
            <span className={styles.chevron}><ChevronRight /></span>
          </div>
          <div className={styles.settingRow} onClick={() => setView('devices')}>
            <span className={styles.settingIcon}><DevicesIcon /></span>
            <span className={styles.settingLabel}>Devices</span>
            <span className={styles.chevron}><ChevronRight /></span>
          </div>
        </div>

        {/* Account section */}
        <p className={styles.sectionLabel}>Account</p>
        <div className={styles.settingsCard}>
          <div className={styles.settingRow} onClick={() => setView('notifications')}>
            <span className={styles.settingIcon}><BellIcon /></span>
            <span className={styles.settingLabel}>Notification Preferences</span>
            <span className={styles.chevron}><ChevronRight /></span>
          </div>
          <div className={styles.settingRow} onClick={toggleTheme}>
            <span className={styles.settingIcon}>{theme === 'dark' ? <MoonIcon /> : <SunIcon />}</span>
            <span className={styles.settingLabel}>Theme</span>
            <span className={styles.settingValue}>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            <span className={styles.chevron}><ChevronRight /></span>
          </div>
          <div className={styles.settingRow} onClick={() => setView('help')}>
            <span className={styles.settingIcon}><HelpIcon /></span>
            <span className={styles.settingLabel}>Help Center</span>
            <span className={styles.chevron}><ChevronRight /></span>
          </div>
          <div className={styles.settingRow} onClick={() => setView('delete')}>
            <span className={`${styles.settingIcon} ${styles.settingIconRed}`}><TrashIcon /></span>
            <span className={`${styles.settingLabel} ${styles.settingLabelRed}`}>Delete Account</span>
            <span className={styles.chevron}><ChevronRight /></span>
          </div>
        </div>

      </div>
    </div>
  );
}
