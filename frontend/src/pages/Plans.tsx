import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlan } from '../types';
import styles from './Plans.module.css';

const PLANS: { plan: UserPlan; name: string; badge: string; color: string; dailyLimit: number; price: string; features: string[] }[] = [
  {
    plan:       'free',
    name:       'Free',
    badge:      '🆓',
    color:      'var(--text-muted)',
    dailyLimit: 5,
    price:      'Free',
    features:   ['₱5/day withdrawal limit', 'PayPal withdrawals', 'Task & offer earnings', 'Referral commissions'],
  },
  {
    plan:       'silver',
    name:       'Silver',
    badge:      '🥈',
    color:      '#9ca3af',
    dailyLimit: 20,
    price:      '₱99/mo',
    features:   ['₱20/day withdrawal limit', 'Choose your withdrawal amount', 'Priority support', 'All Free features'],
  },
  {
    plan:       'gold',
    name:       'Gold',
    badge:      '🥇',
    color:      '#f59e0b',
    dailyLimit: 50,
    price:      '₱199/mo',
    features:   ['₱50/day withdrawal limit', 'Choose your withdrawal amount', 'Priority support', 'All Silver features'],
  },
  {
    plan:       'diamond',
    name:       'Diamond',
    badge:      '💎',
    color:      '#60a5fa',
    dailyLimit: 100,
    price:      '₱399/mo',
    features:   ['₱100/day withdrawal limit', 'Choose your withdrawal amount', 'VIP support', 'All Gold features'],
  },
];

export default function Plans() {
  const { user } = useAuth();
  const currentPlan = user?.plan ?? 'free';

  return (
    <div className="page-container">
      <div className={styles.header}>
        <h1>Upgrade Your Plan</h1>
        <p className={styles.sub}>Unlock higher daily withdrawal limits and more perks.</p>
      </div>

      <div className={styles.grid}>
        {PLANS.map((p) => {
          const isCurrent = p.plan === currentPlan;
          return (
            <div
              key={p.plan}
              className={`${styles.card} ${isCurrent ? styles.cardCurrent : ''}`}
              style={{ '--plan-color': p.color } as React.CSSProperties}
            >
              {isCurrent && <span className={styles.currentBadge}>Current Plan</span>}
              <div className={styles.cardTop}>
                <span className={styles.planEmoji}>{p.badge}</span>
                <div>
                  <h2 className={styles.planName} style={{ color: p.color }}>{p.name}</h2>
                  <p className={styles.planPrice}>{p.price}</p>
                </div>
              </div>

              <p className={styles.limitLine}>
                <span className={styles.limitAmt} style={{ color: p.color }}>₱{p.dailyLimit}</span>
                <span className={styles.limitLabel}>/day withdrawal</span>
              </p>

              <ul className={styles.featureList}>
                {p.features.map((f) => (
                  <li key={f}>
                    <span style={{ color: p.color }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className={styles.currentBtn}>Active</div>
              ) : (
                <a
                  href="mailto:support@kitazon.com?subject=Plan Upgrade Request"
                  className={styles.upgradeBtn}
                  style={{ background: p.color === 'var(--text-muted)' ? undefined : p.color }}
                >
                  Upgrade to {p.name}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <p className={styles.note}>
        To upgrade, contact{' '}
        <a href="mailto:support@kitazon.com" style={{ color: 'var(--primary)' }}>support@kitazon.com</a>
        {' '}or{' '}
        <Link to="/account" style={{ color: 'var(--primary)' }}>open a support ticket</Link>.
      </p>
    </div>
  );
}
