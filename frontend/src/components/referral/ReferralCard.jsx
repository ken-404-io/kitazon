import { useState } from 'react';
import styles from './ReferralCard.module.css';

const TIERS = [
  { name: 'Bronze', min: 5, bonus: '5%', color: '#cd7f32' },
  { name: 'Silver', min: 20, bonus: '10%', color: '#c0c0c0' },
  { name: 'Gold', min: 100, bonus: '15%', color: '#f59e0b' },
];

export default function ReferralCard({ referralCode, referralCount, lifetimeEarnings }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/register?ref=${referralCode}`;

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tier = TIERS.slice().reverse().find(t => referralCount >= t.min);

  return (
    <div className={`card ${styles.wrap}`}>
      <h3>Your Referral Link</h3>
      <p className={styles.sub}>Earn 20% lifetime commission on every referred user's earnings + ₱50 per signup.</p>

      <div className={styles.linkBox}>
        <span className={styles.link}>{link}</span>
        <button className="btn-primary" onClick={copy}>{copied ? '✅ Copied!' : 'Copy'}</button>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <p className={styles.statNum}>{referralCount || 0}</p>
          <p className={styles.statLabel}>Referrals</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statNum}>₱{parseFloat(lifetimeEarnings || 0).toFixed(0)}</p>
          <p className={styles.statLabel}>Earned</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statNum} style={{ color: tier?.color || 'var(--text-muted)' }}>
            {tier?.name || 'None'}
          </p>
          <p className={styles.statLabel}>Tier</p>
        </div>
      </div>

      <div className={styles.tiers}>
        {TIERS.map(t => (
          <div key={t.name} className={`${styles.tier} ${referralCount >= t.min ? styles.active : ''}`} style={{ '--tc': t.color }}>
            <strong style={{ color: t.color }}>{t.name}</strong>
            <span>{t.min}+ referrals</span>
            <span>+{t.bonus} bonus</span>
          </div>
        ))}
      </div>
    </div>
  );
}
