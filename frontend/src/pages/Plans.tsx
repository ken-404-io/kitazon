import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlan } from '../types';
import api from '../services/api';
import styles from './Plans.module.css';

const PLANS: {
  plan: UserPlan;
  name: string;
  badge: string;
  color: string;
  dailyLimit: number;
  price: string;
  priceNum: number;
  features: string[];
}[] = [
  {
    plan:       'free',
    name:       'Free',
    badge:      '🆓',
    color:      'var(--text-muted)',
    dailyLimit: 5,
    price:      'Free',
    priceNum:   0,
    features:   ['₱5/day withdrawal limit', 'GCash withdrawals', 'Task earnings', 'Referral bonuses'],
  },
  {
    plan:       'silver',
    name:       'Silver',
    badge:      '🥈',
    color:      '#9ca3af',
    dailyLimit: 20,
    price:      '₱499/mo',
    priceNum:   499,
    features:   ['₱20/day withdrawal limit', 'Choose your withdrawal amount', 'Priority support', 'All Free features'],
  },
  {
    plan:       'gold',
    name:       'Gold',
    badge:      '🥇',
    color:      '#f59e0b',
    dailyLimit: 50,
    price:      '₱1,299/mo',
    priceNum:   1299,
    features:   ['₱50/day withdrawal limit', 'Choose your withdrawal amount', 'Priority support', 'All Silver features'],
  },
  {
    plan:       'diamond',
    name:       'Diamond',
    badge:      '💎',
    color:      '#60a5fa',
    dailyLimit: 100,
    price:      '₱1,999/mo',
    priceNum:   1999,
    features:   ['₱100/day withdrawal limit', 'Choose your withdrawal amount', 'VIP support', 'All Gold features'],
  },
];

export default function Plans() {
  const { user } = useAuth();
  const currentPlan = user?.plan ?? 'free';
  const [loading, setLoading] = useState<UserPlan | null>(null);
  const [error, setError] = useState('');

  const subscribe = async (plan: UserPlan) => {
    if (plan === 'free') return;
    setError('');
    setLoading(plan);
    try {
      const res = await api.post<{ approvalUrl: string }>('/subscriptions/create', { plan });
      window.location.href = res.data.approvalUrl;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Could not start checkout. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="page-container">
      <div className={styles.header}>
        <h1>Upgrade Your Plan</h1>
        <p className={styles.sub}>Unlock higher daily withdrawal limits and more perks.</p>
      </div>

      {error && <p style={{ textAlign: 'center', color: 'var(--red)', marginBottom: '1rem', fontSize: '0.88rem' }}>{error}</p>}

      <div className={styles.grid}>
        {PLANS.map((p) => {
          const isCurrent   = p.plan === currentPlan;
          const isDowngrade = PLANS.findIndex(x => x.plan === p.plan) < PLANS.findIndex(x => x.plan === currentPlan);
          const isLoading   = loading === p.plan;

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
              ) : p.plan === 'free' || isDowngrade ? (
                <div className={styles.currentBtn} style={{ opacity: 0.4 }}>—</div>
              ) : (
                <button
                  className={styles.upgradeBtn}
                  style={{ background: p.color === 'var(--text-muted)' ? undefined : p.color }}
                  onClick={() => subscribe(p.plan)}
                  disabled={!!loading}
                >
                  {isLoading ? (
                    <span className={styles.btnSpinner} />
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                        <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 0 0-.794.68l-.04.22-.63 3.993-.032.17a.804.804 0 0 1-.794.679H8.969a.483.483 0 0 1-.477-.558L9.134 17h1.024c4.566 0 8.08-2.272 9.14-6.498.39-1.564.33-2.879-.231-3.024z"/>
                        <path d="M17.98 7.17C17.62 5.36 16.25 4.5 14.13 4.5H8.512a.805.805 0 0 0-.795.68L6 17.5h2.565l.634-4.022h2.045c4.293 0 6.777-2.075 7.633-5.7-.004-.023-.006-.044-.009-.068-.282-1.01-.888-1.54-.888-1.54z"/>
                      </svg>
                      Subscribe Now · {p.price}
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className={styles.note}>
        Payments are processed securely via PayPal. We never store your payment information.
      </p>
    </div>
  );
}
