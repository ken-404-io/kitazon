import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { isStrongPassword } from '../utils/sanitize';
import styles from './Auth.module.css';

interface TotpSetup { secret: string; qr: string; }

interface LoginEvent {
  id: number;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function AccountSettings() {
  const { user, logout, refreshUser } = useAuth();

  const [pwForm, setPwForm] = useState({ current: '', next: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [history, setHistory] = useState<LoginEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [verifyMsg, setVerifyMsg] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpMsg, setTotpMsg] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);

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
      const res = await api.post('/auth/resend-verification');
      setVerifyMsg(res.data.message);
      await refreshUser();
    } catch (err: unknown) {
      setVerifyMsg((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.');
    } finally { setVerifyLoading(false); }
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <h2>Account Settings</h2>

      {/* Email verification banner */}
      {user && !user.email_verified && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <strong>Email not verified.</strong> Withdrawals are disabled until you verify your email.
          {' '}<button className="btn-outline" onClick={resendVerification} disabled={verifyLoading} style={{ marginLeft: 8 }}>
            {verifyLoading ? 'Sending...' : 'Resend verification'}
          </button>
          {verifyMsg && <p style={{ marginTop: 8, fontSize: 14 }}>{verifyMsg}</p>}
        </div>
      )}

      {/* Change password */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Change Password</h3>
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
          {pwSuccess && <p style={{ color: 'green' }}>{pwSuccess}</p>}
          <button className="btn-primary" type="submit" disabled={pwLoading}>{pwLoading ? 'Saving...' : 'Change Password'}</button>
        </form>
      </div>

      {/* Login history */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Login History</h3>
        {!history ? (
          <button className="btn-outline" onClick={loadHistory} disabled={historyLoading}>{historyLoading ? 'Loading...' : 'Load History'}</button>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>IP</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Device</th>
                </tr>
              </thead>
              <tbody>
                {history.map(ev => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px' }}>{new Date(ev.created_at).toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', color: ev.success ? 'green' : 'red' }}>{ev.success ? 'Success' : 'Failed'}</td>
                    <td style={{ padding: '6px 8px' }}>{ev.ip_address ?? '—'}</td>
                    <td style={{ padding: '6px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.user_agent ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two-factor authentication */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Two-Factor Authentication (2FA)</h3>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0.5rem 0 1rem' }}>
          {totpEnabled ? '2FA is enabled. Your account is protected.' : 'Add an extra layer of security with an authenticator app.'}
        </p>
        {!totpSetup && !totpEnabled && (
          <button className="btn-primary" disabled={totpLoading} onClick={async () => {
            setTotpLoading(true); setTotpMsg('');
            try { const r = await api.post<TotpSetup>('/totp/setup', {}); setTotpSetup(r.data); }
            catch { setTotpMsg('Failed to start setup.'); }
            finally { setTotpLoading(false); }
          }}>{totpLoading ? 'Loading...' : 'Enable 2FA'}</button>
        )}
        {totpSetup && (
          <div>
            <p style={{ fontSize: 13, marginBottom: 8 }}>Scan this QR code with Google Authenticator or Authy, then enter the 6-digit code to confirm:</p>
            <img src={totpSetup.qr} alt="QR code" style={{ width: 180, height: 180, borderRadius: 8, marginBottom: 12 }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, wordBreak: 'break-all' }}>Manual key: {totpSetup.secret}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="000000" maxLength={6} style={{ width: 120 }} />
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
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="Enter code to disable" maxLength={6} style={{ width: 180 }} />
              <button className="btn-outline" style={{ borderColor: '#dc2626', color: '#dc2626' }} disabled={totpLoading} onClick={async () => {
                setTotpLoading(true); setTotpMsg('');
                try {
                  await api.post('/totp/disable', { code: totpCode });
                  setTotpEnabled(false); setTotpMsg('2FA disabled.');
                } catch (err: unknown) {
                  setTotpMsg((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.');
                } finally { setTotpLoading(false); }
              }}>Disable 2FA</button>
            </div>
          </div>
        )}
        {totpMsg && <p style={{ marginTop: 8, fontSize: 14, color: totpMsg.includes('!') ? 'green' : 'var(--red)' }}>{totpMsg}</p>}
      </div>

      {/* Delete account */}
      <div className="card" style={{ border: '1px solid #fca5a5' }}>
        <h3 style={{ color: '#dc2626' }}>Delete Account</h3>
        <p style={{ fontSize: 14, color: '#6b7280' }}>This permanently anonymizes your account. Your earnings history is preserved for audit purposes.</p>
        {!confirmDelete ? (
          <button className="btn-outline" style={{ borderColor: '#dc2626', color: '#dc2626' }} onClick={() => setConfirmDelete(true)}>Delete My Account</button>
        ) : (
          <form onSubmit={deleteAccount}>
            <div className="form-group">
              <label>Enter your password to confirm</label>
              <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} required maxLength={128} autoComplete="current-password" />
            </div>
            {deleteError && <p className="error-msg">{deleteError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ background: '#dc2626' }} disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Confirm Delete'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
