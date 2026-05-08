import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { validatePasswordField, validateConfirmPassword } from '../utils/sanitize';
import PasswordStrength from '../components/ui/PasswordStrength';
import PasswordInput from '../components/ui/PasswordInput';
import styles from './Auth.module.css';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [touched, setTouched]     = useState({ password: false, confirm: false });
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [loading, setLoading]     = useState(false);

  const blur = (f: keyof typeof touched) => () => setTouched(p => ({ ...p, [f]: true }));

  const passwordErr = touched.password ? validatePasswordField(password) : null;
  const confirmErr  = touched.confirm  ? validateConfirmPassword(password, confirm) : null;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    if (!token) { setError('Missing reset token. Please use the link from your email.'); return; }
    setTouched({ password: true, confirm: true });
    if (validatePasswordField(password) || validateConfirmPassword(password, confirm)) return;
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>('/auth/reset-password', { token, password });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Reset failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2>Reset Password</h2>
        <p className={styles.sub}>Choose a new password for your account</p>
        {success ? (
          <div style={{ color: '#22c55e', fontSize: '0.9rem' }}>{success} Redirecting to login…</div>
        ) : (
          <form onSubmit={submit} autoComplete="off" noValidate>
            <div className="form-group">
              <label>New Password</label>
              <PasswordInput
                value={password}
                onChange={e => setPassword(e.target.value)}
                onBlur={blur('password')}
                inputClass={touched.password ? (passwordErr ? 'field-invalid' : 'field-valid') : ''}
                required
                autoFocus
                autoComplete="new-password"
                maxLength={128}
              />
              <PasswordStrength password={password} />
              {passwordErr && <p className="field-hint hint-invalid">{passwordErr}</p>}
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <PasswordInput
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onBlur={blur('confirm')}
                inputClass={touched.confirm ? (confirmErr ? 'field-invalid' : (confirm ? 'field-valid' : '')) : ''}
                required
                autoComplete="new-password"
                maxLength={128}
              />
              {confirmErr
                ? <p className="field-hint hint-invalid">{confirmErr}</p>
                : touched.confirm && confirm && !confirmErr
                  ? <p className="field-hint hint-valid">Passwords match ✓</p>
                  : null
              }
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}
        <p className={styles.switch}><Link to="/login">Back to Login</Link></p>
      </div>
    </div>
  );
}
