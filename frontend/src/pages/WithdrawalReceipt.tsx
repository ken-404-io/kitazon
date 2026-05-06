import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Withdrawal } from '../types';
import { Skeleton } from '../components/ui/Skeleton';
import { WalletIcon2, PrintIcon } from '../components/ui/Icons';

const STATUS_COLORS: Record<string, string> = {
  pending: '#d97706', processing: '#2563eb', completed: '#16a34a', failed: '#dc2626',
};

export default function WithdrawalReceipt() {
  const { id } = useParams<{ id: string }>();
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Withdrawal>(`/withdrawals/${id}`)
      .then((r) => setWithdrawal(r.data))
      .catch(() => setError('Withdrawal not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="page-container" style={{ maxWidth: 480 }}>
      <Skeleton height={32} width="60%" style={{ marginBottom: 16 }} />
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={20} style={{ marginBottom: 10 }} />)}
    </div>
  );

  if (error || !withdrawal) return (
    <div className="page-container" style={{ textAlign: 'center' }}>
      <p className="error-msg">{error || 'Withdrawal not found.'}</p>
      <Link to="/withdraw">Back to Withdrawals</Link>
    </div>
  );

  return (
    <div className="page-container" style={{ maxWidth: 480 }}>
      <div className="card" id="receipt" style={{ padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{ color: 'var(--gold)', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <WalletIcon2 />
          </span>
          <h2 style={{ margin: '0.5rem 0' }}>Kitazon</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Withdrawal Receipt</p>
        </div>

        <div style={{ borderTop: '1px dashed var(--dark-border)', borderBottom: '1px dashed var(--dark-border)', padding: '1rem 0', marginBottom: '1rem' }}>
          {[
            { label: 'Reference #', value: `KTZ-${String(withdrawal.id).padStart(6, '0')}` },
            { label: 'Date', value: new Date(withdrawal.created_at).toLocaleString('en-PH') },
            { label: 'Channel', value: String(withdrawal.channel).toUpperCase() },
            { label: 'Account', value: withdrawal.account_number },
            { label: 'Amount', value: `₱${Number(withdrawal.amount).toFixed(2)}` },
            { label: 'Fee', value: `₱${Number(withdrawal.fee).toFixed(2)}` },
            { label: 'Net Payout', value: `₱${Number(withdrawal.net_amount).toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
            <span style={{ color: 'var(--text-muted)' }}>Status</span>
            <span style={{ fontWeight: 700, color: STATUS_COLORS[withdrawal.status] ?? '#fff' }}>
              {withdrawal.status.toUpperCase()}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Thank you for using Kitazon. Keep earning!
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }} className="no-print">
        <button className="btn-primary" onClick={() => window.print()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <PrintIcon /> Print Receipt
        </button>
        <Link to="/withdraw" style={{ flex: 1 }}>
          <button className="btn-outline" style={{ width: '100%' }}>Back</button>
        </Link>
      </div>

      <style>{`@media print { .no-print { display: none; } body { background: #fff; color: #000; } }`}</style>
    </div>
  );
}
