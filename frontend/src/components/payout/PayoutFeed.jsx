import { useEffect, useState } from 'react';
import api from '../../services/api';
import styles from './PayoutFeed.module.css';

const CHANNEL_ICONS = {
  gcash: '💙',
  maya: '💚',
  bpi: '🏦',
  bdo: '🏦',
  unionbank: '🏦',
  gotyme: '💳',
  coins: '🪙',
  usdt: '💵',
};

export default function PayoutFeed() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payouts/feed')
      .then(res => setPayouts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={styles.loading}>Loading payouts...</p>;

  return (
    <div className={styles.feed}>
      {payouts.length === 0 && <p className={styles.empty}>No payouts yet. Be the first!</p>}
      {payouts.map(p => (
        <div key={p.id} className={`card ${styles.row}`}>
          <span>{CHANNEL_ICONS[p.channel] || '💰'}</span>
          <div className={styles.info}>
            <p className={styles.name}>{p.masked_name}</p>
            <p className={styles.time}>{new Date(p.created_at).toLocaleString('en-PH')}</p>
          </div>
          <p className={styles.amount}>₱{parseFloat(p.amount).toFixed(2)}</p>
          <span className="badge badge-green">Paid</span>
        </div>
      ))}
    </div>
  );
}
