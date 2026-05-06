import { useState } from 'react';
import styles from './WithdrawForm.module.css';

interface Props {
  amount: number;
  onConfirm: (otp: string) => Promise<void>;
  onCancel: () => void;
  error?: string;
}

export default function OtpModal({ amount, onConfirm, onCancel, error }: Props) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return;
    setLoading(true);
    try { await onConfirm(otp); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="card" style={{ maxWidth: 360, width: '90%' }}>
        <h3>Enter OTP</h3>
        <p>A 6-digit code was sent to your email to confirm your withdrawal of <strong>₱{amount.toFixed(2)}</strong>.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
              autoFocus
              required
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-outline" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading || otp.length !== 6} style={{ flex: 1 }}>
              {loading ? 'Verifying...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
