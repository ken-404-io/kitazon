import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Payout } from '../../types';
import { DollarIcon } from '../ui/Icons';
import { payoutSeedData } from './payoutSeedData';
import styles from './PayoutFeed.module.css';

export default function PayoutFeed() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Payout[]>('/payouts/feed')
      .then((res) => {
        const real = Array.isArray(res.data) ? res.data : [];
        const merged = [...real, ...payoutSeedData as unknown as Payout[]];
        merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setPayouts(merged);
      })
      .catch(() => {
        setPayouts(
          [...payoutSeedData as unknown as Payout[]].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        );
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className={styles.feed}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`card ${styles.row}`} style={{ gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2a2a2a', animation: 'shimmer 1.4s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg,#2a2a2a 25%,#3a3a3a 50%,#2a2a2a 75%)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ height: 14, width: '40%', borderRadius: 4, background: '#2a2a2a', animation: 'shimmer 1.4s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg,#2a2a2a 25%,#3a3a3a 50%,#2a2a2a 75%)' }} />
            <div style={{ height: 11, width: '25%', borderRadius: 4, background: '#2a2a2a', animation: 'shimmer 1.4s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg,#2a2a2a 25%,#3a3a3a 50%,#2a2a2a 75%)' }} />
          </div>
          <div style={{ height: 20, width: 60, borderRadius: 4, background: '#2a2a2a', animation: 'shimmer 1.4s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg,#2a2a2a 25%,#3a3a3a 50%,#2a2a2a 75%)' }} />
        </div>
      ))}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );

  return (
    <div className={styles.feed}>
      {payouts.map((p) => (
        <div key={p.id} className={`card ${styles.row}`}>
          <span className={styles.channelIcon}><DollarIcon /></span>
          <div className={styles.info}>
            <p className={styles.name}>{p.masked_name}</p>
            <p className={styles.time}>{new Date(p.created_at).toLocaleString('en-PH')}</p>
          </div>
          <p className={styles.amount}>₱{parseFloat(String(p.amount)).toFixed(2)}</p>
          <span className="badge badge-green">Paid</span>
        </div>
      ))}
    </div>
  );
}
