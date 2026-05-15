import { useState } from 'react';
import api from '../../services/api';
import { sanitizeInput } from '../../utils/sanitize';
import OtpModal from './OtpModal';
import styles from './WithdrawForm.module.css';

interface FormState {
  amount: string;
  account_number: string;
}

interface Props {
  balance?: number | string;
  emailVerified?: boolean;
  onSuccess?: (amount: number) => void;
}

export default function WithdrawForm({ balance, emailVerified = true, onSuccess }: Props) {
  const numBalance = Number(balance ?? 0);
  const [form, setForm] = useState<FormState>({ amount: '', account_number: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const requestOtp = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(''); setSuccess('');
    const raw = sanitizeInput(form.account_number);
    const digits = raw.replace(/[^\d+]/g, '');
    const account_number = digits.startsWith('+63') && digits.length === 13 ? '0' + digits.slice(3) : digits;
    if (!account_number) return setError('GCash mobile number is required.');
    if (!/^09\d{9}$/.test(account_number)) return setError('Enter a valid GCash number (11 digits starting with 09).');
    if (parseFloat(form.amount) < 5) return setError('Minimum withdrawal is ₱5.');
    if (parseFloat(form.amount) > numBalance) return setError('Insufficient balance.');
    setLoading(true);
    try {
      await api.post('/withdrawals/request-otp', { amount: form.amount });
      setShowOtp(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Failed to send OTP. Please try again.');
    } finally { setLoading(false); }
  };

  const confirmWithdrawal = async (otp: string): Promise<void> => {
    setOtpError('');
    const raw = sanitizeInput(form.account_number);
    const digits = raw.replace(/[^\d+]/g, '');
    const account_number = digits.startsWith('+63') && digits.length === 13 ? '0' + digits.slice(3) : digits;
    try {
      await api.post('/withdrawals', { amount: form.amount, channel: 'gcash', account_number, otp });
      setSuccess(`Withdrawal of ₱${form.amount} submitted! Processing within 24 hours.`);
      setForm({ amount: '', account_number: '' });
      setShowOtp(false);
      onSuccess?.(parseFloat(form.amount));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setOtpError(msg ?? 'Invalid OTP. Please try again.');
    }
  };

  if (!emailVerified) {
    return (
      <div className={`card ${styles.form}`}>
        <h3>Request Withdrawal</h3>
        <p className="error-msg">Please verify your email address before making withdrawals. Check your inbox or visit Account Settings.</p>
      </div>
    );
  }

  return (
    <>
      <form className={`card ${styles.form}`} onSubmit={requestOtp}>
        <h3>Request Withdrawal</h3>
        <p className={styles.balance}>Available: <strong>₱{numBalance.toFixed(2)}</strong></p>
        <div className="form-group">
          <label>Amount</label>
          <input type="number" min="5" max="50000" value={form.amount} onChange={set('amount')} required />
        </div>
        <div className="form-group">
          <label>GCash Mobile Number</label>
          <input type="tel" inputMode="tel" value={form.account_number} onChange={set('account_number')} required placeholder="09171234567" maxLength={13} autoComplete="tel" />
        </div>
        {error && <p className="error-msg">{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Sending OTP...' : 'Continue — Send OTP'}
        </button>
        <p className={styles.note}>An OTP will be sent to your email to confirm. Zero fee on first ₱500/month · ₱5 flat fee after.</p>
      </form>

      {showOtp && (
        <OtpModal
          amount={parseFloat(form.amount)}
          onConfirm={confirmWithdrawal}
          onCancel={() => setShowOtp(false)}
          error={otpError}
        />
      )}
    </>
  );
}
