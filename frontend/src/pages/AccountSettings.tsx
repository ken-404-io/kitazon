import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { isStrongPassword, validateName, validatePasswordField } from '../utils/sanitize';
import PasswordStrength from '../components/ui/PasswordStrength';
import PasswordInput from '../components/ui/PasswordInput';
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
const LogoutIcon   = () => <svg {...sz}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
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
type View = 'main' | 'edit-profile' | 'change-password' | '2fa' | 'login-history' | 'devices' | 'notifications' | 'help' | 'delete' | 'checkin';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<View>((searchParams.get('view') as View) ?? 'main');
  const [balance, setBalance] = useState<number>(0);

  const [pwForm, setPwForm]       = useState({ current: '', next: '' });
  const [pwTouched, setPwTouched] = useState({ current: false, next: false });
  const [pwError, setPwError]     = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const pwBlur = (f: keyof typeof pwTouched) => () => setPwTouched(p => ({ ...p, [f]: true }));
  const pwCurrentErr = pwTouched.current ? (!pwForm.current ? 'Current password is required.' : null) : null;
  const pwNextErr    = pwTouched.next    ? validatePasswordField(pwForm.next) : null;

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError]       = useState('');
  const [deleteLoading, setDeleteLoading]   = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);

  const [history, setHistory]         = useState<LoginEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [profileName, setProfileName]     = useState(user?.name ?? '');
  const [profileTouched, setProfileTouched] = useState(false);
  const [profileError, setProfileError]   = useState('');
  const [profileMsg, setProfileMsg]       = useState('');
  const [profileLoad, setProfileLoad]     = useState(false);

  const [avatarUrl, setAvatarUrl]         = useState(user?.avatar_url ?? '');
  const [avatarSaving, setAvatarSaving]   = useState(false);
  const [avatarMsg, setAvatarMsg]         = useState('');
  const [avatarError, setAvatarError]     = useState('');

  const profileNameErr = profileTouched ? validateName(profileName) : null;

  const [sessionMsg, setSessionMsg]   = useState('');
  const [sessionLoad, setSessionLoad] = useState(false);

  const [verifyMsg, setVerifyMsg]     = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [totpSetup, setTotpSetup]   = useState<TotpSetup | null>(null);
  const [totpCode, setTotpCode]     = useState('');
  const [totpMsg, setTotpMsg]       = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(user?.totp_enabled ?? false);

  // Check-in state
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinMsg, setCheckinMsg]         = useState('');
  const [checkinStreak, setCheckinStreak]   = useState<number | null>(null);
  const [checkinDone, setCheckinDone]       = useState(false);

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

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(''); setProfileMsg('');
    const trimmed = profileName.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setProfileError('Name must be 2–100 characters.'); return;
    }
    setProfileLoad(true);
    try {
      const res = await api.patch<{ name: string }>('/account/profile', { name: trimmed });
      setProfileMsg('Name updated successfully.');
      await refreshUser();
      setProfileName(res.data.name);
    } catch (err: unknown) {
      setProfileError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.');
    } finally { setProfileLoad(false); }
  };

  const saveAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAvatarError(''); setAvatarMsg('');
    const url = avatarUrl.trim();
    if (url && !url.startsWith('https://')) {
      setAvatarError('URL must start with https://'); return;
    }
    setAvatarSaving(true);
    try {
      await api.patch('/account/avatar', { avatar_url: url || null });
      setAvatarMsg('Avatar updated.');
      await refreshUser();
    } catch (err: unknown) {
      setAvatarError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to save avatar.');
    } finally { setAvatarSaving(false); }
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

  /* ── Edit Profile view ───────────────────────────────────────────────────── */
  if (view === 'edit-profile') return (
    <div className="page-container">
      <SubView title="Edit Profile">
        <div className={styles.formCard}>
          <form onSubmit={saveProfile} noValidate>
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                onBlur={() => setProfileTouched(true)}
                className={profileTouched ? (profileNameErr ? 'field-invalid' : 'field-valid') : ''}
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
              />
              {profileNameErr && <p className="field-hint hint-invalid">{profileNameErr}</p>}
            </div>
            {profileError && <p className="error-msg">{profileError}</p>}
            {profileMsg && <p className={styles.successMsg}>{profileMsg}</p>}
            <button className="btn-primary" type="submit" disabled={profileLoad} style={{ width: '100%', marginTop: 4 }}>
              {profileLoad ? 'Saving…' : 'Save Name'}
            </button>
          </form>

          <hr style={{ border: 'none', borderTop: '1px solid var(--dark-border)', margin: '1.25rem 0' }} />

          <form onSubmit={saveAvatar} noValidate>
            <div className="form-group">
              <label>Avatar URL</label>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {avatarUrl && avatarUrl.startsWith('https://') && (
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--dark-border)' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  maxLength={500}
                  autoComplete="off"
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            {avatarError && <p className="error-msg">{avatarError}</p>}
            {avatarMsg && <p className={styles.successMsg}>{avatarMsg}</p>}
            <button className="btn-primary" type="submit" disabled={avatarSaving} style={{ width: '100%', marginTop: 4 }}>
              {avatarSaving ? 'Saving…' : 'Save Avatar'}
            </button>
          </form>
        </div>
      </SubView>
    </div>
  );

  /* ── Change Password view ─────────────────────────────────────────────────── */
  if (view === 'change-password') return (
    <div className="page-container">
      <SubView title="Change Password">
        <div className={styles.formCard}>
          <form onSubmit={changePassword} noValidate>
            <div className="form-group">
              <label>Current Password</label>
              <PasswordInput
                value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                onBlur={pwBlur('current')}
                inputClass={pwTouched.current ? (pwCurrentErr ? 'field-invalid' : 'field-valid') : ''}
                required
                maxLength={128}
                autoComplete="current-password"
              />
              {pwCurrentErr && <p className="field-hint hint-invalid">{pwCurrentErr}</p>}
            </div>
            <div className="form-group">
              <label>New Password</label>
              <PasswordInput
                value={pwForm.next}
                onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                onBlur={pwBlur('next')}
                inputClass={pwTouched.next ? (pwNextErr ? 'field-invalid' : 'field-valid') : ''}
                required
                maxLength={128}
                autoComplete="new-password"
              />
              <PasswordStrength password={pwForm.next} />
              {pwNextErr && <p className="field-hint hint-invalid">{pwNextErr}</p>}
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

  /* ── Devices / Sessions view ─────────────────────────────────────────────── */
  if (view === 'devices') return (
    <div className="page-container">
      <SubView title="Active Sessions">
        <div className={styles.formCard}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
            Signed in on this device. You can sign out all <strong style={{ color: 'var(--text)' }}>other</strong> devices if you think your account has been compromised.
          </p>
          {sessionMsg && (
            <p style={{ fontSize: 13, color: sessionMsg.includes('other') ? '#22c55e' : 'var(--red)', marginBottom: '0.75rem' }}>{sessionMsg}</p>
          )}
          <button
            className="btn-outline"
            style={{ width: '100%', borderColor: 'var(--red)', color: 'var(--red)' }}
            disabled={sessionLoad}
            onClick={async () => {
              setSessionLoad(true); setSessionMsg('');
              try {
                const r = await api.post<{ revoked: number }>('/account/revoke-sessions', {});
                setSessionMsg(`Done — ${r.data.revoked} other session${r.data.revoked !== 1 ? 's' : ''} signed out.`);
              } catch {
                setSessionMsg('Failed. Please try again.');
              } finally { setSessionLoad(false); }
            }}
          >
            {sessionLoad ? 'Revoking…' : 'Sign Out All Other Devices'}
          </button>
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

  /* ── Check-in view ──────────────────────────────────────────────────────── */
  if (view === 'checkin') {
    const handleCheckin = async () => {
      setCheckinLoading(true); setCheckinMsg('');
      try {
        // Try to get status first
        try {
          const status = await api.get<{ streak: number; already_claimed: boolean }>('/tasks/checkin-status');
          if (status.data.already_claimed) {
            setCheckinDone(true);
            setCheckinStreak(status.data.streak);
            setCheckinMsg('Already claimed today! Come back tomorrow ✓');
            return;
          }
          setCheckinStreak(status.data.streak);
        } catch {
          // endpoint may not exist, proceed to claim
        }
        const res = await api.post<{ amount: number; streak: number }>('/tasks/checkin', {});
        setCheckinDone(true);
        setCheckinStreak(res.data.streak ?? null);
        setCheckinMsg(`You earned ₱${Number(res.data.amount ?? 0).toFixed(2)}! Streak: ${res.data.streak ?? 1} days 🔥`);
        await refreshUser();
      } catch (err: unknown) {
        const apiErr = err as { response?: { data?: { message?: string } } };
        const msg = apiErr.response?.data?.message ?? 'Failed to claim bonus.';
        if (msg.toLowerCase().includes('already')) {
          setCheckinDone(true);
          setCheckinMsg('Already claimed today! Come back tomorrow ✓');
        } else {
          setCheckinMsg(msg);
        }
      } finally { setCheckinLoading(false); }
    };

    return (
      <div className="page-container">
        <SubView title="Daily Check-in Bonus">
          <div className={styles.formCard} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: '0.5rem' }}>🎁</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.25rem' }}>Daily Check-in</h3>
            {checkinStreak !== null && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Current streak: <strong style={{ color: 'var(--primary-amber)' }}>{checkinStreak} days 🔥</strong>
              </p>
            )}
            {!checkinDone && !checkinMsg && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Claim your daily bonus and build your streak!
              </p>
            )}
            {checkinMsg && (
              <p style={{
                fontSize: 14,
                fontWeight: 600,
                color: checkinMsg.includes('earned') ? 'var(--primary-amber)' : checkinMsg.includes('Already') ? '#22c55e' : 'var(--red)',
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: 'var(--primary-subtle)',
                borderRadius: 12,
              }}>
                {checkinMsg}
              </p>
            )}
            {!checkinDone && (
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 800 }}
                disabled={checkinLoading}
                onClick={handleCheckin}
              >
                {checkinLoading ? 'Claiming…' : 'Claim Today\'s Bonus'}
              </button>
            )}
          </div>
        </SubView>
      </div>
    );
  }

  /* ── Main view ───────────────────────────────────────────────────────────── */
  const emailVerified = user?.email_verified;
  const twoFaStatus   = totpEnabled ? 'Enabled' : 'Disabled';

  // Security score: 1 pt per completed item (max 3 shown)
  const secItems = [
    { label: 'Email verified',          done: !!emailVerified },
    { label: '2FA enabled',             done: totpEnabled },
    { label: 'Account active',          done: true },
  ];
  const secScore = secItems.filter(i => i.done).length;
  const secColor = secScore === 3 ? '#22c55e' : secScore === 2 ? '#f97316' : '#ef4444';
  const secLabel = secScore === 3 ? 'Strong' : secScore === 2 ? 'Good' : 'Needs improvement';

  return (
    <div className="page-container">
      <div className={styles.page}>

        {/* Page header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Account Settings</h1>
            <p className={styles.pageSub}>Manage your account and security.</p>
          </div>
        </div>

        {/* Profile card */}
        <div className={styles.profileCard} onClick={() => { setProfileName(user?.name ?? ''); setAvatarUrl(user?.avatar_url ?? ''); setProfileMsg(''); setProfileError(''); setAvatarMsg(''); setAvatarError(''); setView('edit-profile'); }}>
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className={styles.avatar}
              style={{ objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className={styles.avatar}>{initials(user?.name)}</div>
          )}
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

        {/* Security score card */}
        <div className={styles.secScoreCard}>
          <div className={styles.secScoreLeft}>
            <p className={styles.secScoreTitle}>Security Score</p>
            <p className={styles.secScoreLabel} style={{ color: secColor }}>{secLabel}</p>
          </div>
          <div className={styles.secScoreBars}>
            {secItems.map(item => (
              <div key={item.label} className={styles.secScoreRow}>
                <span style={{ color: item.done ? '#22c55e' : 'var(--text-muted)', fontSize: 12 }}>{item.done ? '✓' : '○'}</span>
                <span style={{ fontSize: 12, color: item.done ? 'var(--text)' : 'var(--text-muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Last login */}
        {user?.last_login_at && (
          <p className={styles.lastLogin}>
            Last sign-in: {new Date(user.last_login_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
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

        {/* Daily Check-in */}
        <div className={styles.settingsCard} style={{ marginBottom: 0 }}>
          <div className={styles.settingRow} onClick={() => { setCheckinMsg(''); setCheckinDone(false); setCheckinStreak(null); setView('checkin'); }}>
            <span className={styles.settingIcon}>🎁</span>
            <span className={styles.settingLabel}>Daily Check-in Bonus</span>
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

        {/* Quick Navigation section */}
        <p className={styles.sectionLabel}>Quick Navigation</p>
        <div className={styles.settingsCard}>
          {[
            { label: 'Referral Program', path: '/referral' },
            { label: 'Upgrade Plan',     path: '/plans' },
            { label: 'Leaderboard',      path: '/leaderboard' },
            { label: 'Earnings Guide',   path: '/guide' },
            { label: 'Bonus Center',     path: '/bonus' },
            { label: 'Payout Proof',     path: '/payout-proof' },
          ].map(item => (
            <div key={item.path} className={styles.settingRow} onClick={() => navigate(item.path)}>
              <span className={styles.settingLabel}>{item.label}</span>
              <span className={styles.chevron}><ChevronRight /></span>
            </div>
          ))}
        </div>

        {/* Logout */}
        <button
          className={styles.logoutBtn}
          onClick={async () => { await logout(); navigate('/'); }}
        >
          <LogoutIcon /> Sign Out
        </button>

      </div>
    </div>
  );
}
