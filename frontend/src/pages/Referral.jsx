import { useEffect, useState } from 'react';
import ReferralCard from '../components/referral/ReferralCard';
import api from '../services/api';
import styles from './Referral.module.css';

export default function Referral() {
  const [data, setData] = useState(null);
  const [referrals, setReferrals] = useState([]);

  useEffect(() => {
    api.get('/referrals').then(res => { setData(res.data.stats); setReferrals(res.data.list); }).catch(() => {});
  }, []);

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: '0.25rem' }}>Referral Program</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Earn 20% lifetime commission · ₱50 per referred signup</p>

      <div className={styles.layout}>
        <ReferralCard
          referralCode={data?.referral_code}
          referralCount={data?.referral_count}
          lifetimeEarnings={data?.lifetime_earnings}
        />

        <div>
          <h3 style={{ marginBottom: '0.75rem' }}>Your Referrals ({referrals.length})</h3>
          {referrals.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No referrals yet. Share your link and start earning!
            </div>
          ) : referrals.map(r => (
            <div key={r.id} className={`card ${styles.row}`}>
              <div>
                <p className={styles.name}>{r.name}</p>
                <p className={styles.time}>Joined {new Date(r.created_at).toLocaleDateString('en-PH')}</p>
              </div>
              <span className="badge badge-gold">+₱{parseFloat(r.commission_earned || 0).toFixed(2)} earned</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
