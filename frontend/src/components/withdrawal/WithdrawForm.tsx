import { useState } from 'react';
import api from '../../services/api';
import { WithdrawalChannel } from '../../types';
import styles from './WithdrawForm.module.css';

const CHANNELS: { value: WithdrawalChannel; label: string }[] = [
  { value: 'gcash', label: 'GCash (1 hour)' },
  { value: 'maya', label: 'Maya (1 hour)' },
  { value: 'gotyme', label: 'GoTyme (1-24 hours)' },
  { value: 'bpi', label: 'BPI (1-24 hours)' },
  { value: 'bdo', label: 'BDO (1-24 hours)' },
  { value: 'unionbank', label: 'UnionBank (1-24 hours)' },
  { value: 'coins', label: 'Coins.ph (1-24 hours)' },
  { value: 'usdt', label: 'USDT (1-24 hours)' },
];

const INSTANT_CHANNELS: WithdrawalChannel[] = ['gcash', 'maya'];

interface FormState {
  amount: string;
  channel: WithdrawalChannel;
  account_number: string;
}

interface Props {
  balance?: number;
  onSuccess?: (amount: number) => void;
}

export default function WithdrawForm({ balance = 0 as number | string, onSuccess }: Props) {
  const numBalance = Number(balance);
  const [form, setForm] = useState<FormState>({ amount: '', channel: 'gcash', account_number: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (parseFloat(form.amount) < 50) return setError('Minimum withdrawal is ₱50.');
    if (parseFloat(form.amount) > numBalance) return setError('Insufficient balance.');
    setLoading(true);
    try {
      await api.post('/withdrawals', form);
      const eta = INSTANT_CHANNELS.includes(form.channel) ? '1 hour' : '24 hours';
      setSuccess(`Withdrawal of ₱${form.amount} submitted! Processing within ${eta}.`);
      setForm((f) => ({ ...f, amount: '', account_number: '' }));
      onSuccess?.(parseFloat(form.amount));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Withdrawal failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={`card ${styles.form}`} onSubmit={submit}>
      <h3>Request Withdrawal</h3>
      <p className={styles.balance}>Available: <strong>₱{numBalance.toFixed(2)}</strong></p>

      <div className="form-group">
        <label>Amount (min ₱50)</label>
        <input type="number" min="50" value={form.amount} onChange={set('amount')} required />
      </div>

      <div className="form-group">
        <label>Payment Channel</label>
        <select value={form.channel} onChange={set('channel')}>
          {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Account / Wallet Number</label>
        <input type="text" value={form.account_number} onChange={set('account_number')} required placeholder="09XXXXXXXXX or account number" />
      </div>

      {error && <p className="error-msg">{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? 'Processing...' : 'Request Withdrawal'}
      </button>
      <p className={styles.note}>Zero fee on first ₱500/month cashout. ₱5 flat fee after.</p>
    </form>
  );
}
