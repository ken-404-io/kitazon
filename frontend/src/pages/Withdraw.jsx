import { useEffect, useState } from 'react';
import WithdrawForm from '../components/withdrawal/WithdrawForm';
import api from '../services/api';
import styles from './Withdraw.module.css';

const STATUS_BADGE = { pending: 'badge-gold', processing: 'badge-gold', completed: 'badge-green', failed: 'badge-red' };

export default function Withdraw() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  const loadData = () => {
    api.get('/auth/me/stats').then(res => setStats(res.data)).catch(() => {});
    api.get('/withdrawals').then(res => setHistory(res.data)).catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  const handleSuccess = () => loadData();

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: '0.25rem' }}>Withdraw Earnings</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>GCash & Maya processed in 1 hour · Banks within 24 hours</p>

      <div className={styles.layout}>
        <WithdrawForm balance={stats?.balance} onSuccess={handleSuccess} />

        <div className={styles.history}>
          <h3>Withdrawal History</h3>
          {history.length === 0 ? (
            <p className={styles.empty}>No withdrawals yet.</p>
          ) : history.map(w => (
            <div key={w.id} className={`card ${styles.row}`}>
              <div>
                <p className={styles.channel}>{w.channel.toUpperCase()} · {w.account_number}</p>
                <p className={styles.time}>{new Date(w.created_at).toLocaleString('en-PH')}</p>
              </div>
              <div className={styles.right}>
                <p className={styles.amount}>₱{parseFloat(w.amount).toFixed(2)}</p>
                <span className={`badge ${STATUS_BADGE[w.status] || 'badge-gold'}`}>{w.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
