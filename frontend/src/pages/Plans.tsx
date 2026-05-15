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

const GCASH_QR_URL   = process.env.REACT_APP_GCASH_QR_URL   ?? '';
const GCASH_NUMBER   = process.env.REACT_APP_GCASH_NUMBER   ?? '';
const GCASH_NAME     = process.env.REACT_APP_GCASH_NAME     ?? 'Kitazon';

export default function Plans() {
  const { user } = useAuth();
  const currentPlan = user?.plan ?? 'free';

  const [modal, setModal] = useState<typeof PLANS[number] | null>(null);
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const openModal = (p: typeof PLANS[number]) => {
    setModal(p);
    setReference('');
    setSubmitError('');
    setSubmitted(false);
  };

  const closeModal = () => {
    if (submitting) return;
    setModal(null);
  };

  const handleSubmit = async () => {
    if (!modal) return;
    setSubmitError('');
    if (reference.trim().length < 5) {
      setSubmitError('Please enter your GCash reference number.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/subscriptions/gcash-submit', { plan: modal.plan, reference: reference.trim() });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setSubmitError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className={styles.header}>
        <h1>Upgrade Your Plan</h1>
        <p className={styles.sub}>Unlock higher daily withdrawal limits and more perks.</p>
      </div>

      <div className={styles.grid}>
        {PLANS.map((p) => {
          const isCurrent   = p.plan === currentPlan;
          const isDowngrade = PLANS.findIndex(x => x.plan === p.plan) < PLANS.findIndex(x => x.plan === currentPlan);

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
                  onClick={() => openModal(p)}
                >
                  <span className={styles.gcashIcon}>G</span>
                  Pay via GCash · {p.price}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className={styles.note}>
        Payments are made via GCash. After sending, submit your reference number below and the admin will activate your plan within 24 hours.
      </p>

      {/* ── GCash Payment Modal ── */}
      {modal && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={closeModal} aria-label="Close">✕</button>

            {submitted ? (
              <div className={styles.successState}>
                <div className={styles.successIcon}>✓</div>
                <h3>Payment Submitted!</h3>
                <p>Your reference number has been received. The admin will verify your GCash payment and activate your <strong style={{ color: modal.color }}>{modal.name}</strong> plan within 24 hours.</p>
                <button className={styles.upgradeBtn} style={{ background: modal.color, marginTop: '1rem' }} onClick={closeModal}>
                  Got it
                </button>
              </div>
            ) : (
              <>
                <div className={styles.modalHeader}>
                  <span style={{ fontSize: '1.5rem' }}>{modal.badge}</span>
                  <div>
                    <h3 style={{ margin: 0, color: modal.color }}>{modal.name} Plan</h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{modal.price}</p>
                  </div>
                </div>

                <div className={styles.gcashInstruction}>
                  <p className={styles.instructionTitle}>Send exactly <strong style={{ color: '#0073e6' }}>₱{modal.priceNum.toLocaleString()}</strong> to this GCash account:</p>

                  {GCASH_QR_URL ? (
                    <div className={styles.qrWrapper}>
                      <img src={GCASH_QR_URL} alt="GCash QR Code" className={styles.qrImage} />
                    </div>
                  ) : (
                    <div className={styles.qrPlaceholder}>
                      <span className={styles.gcashIconLarge}>G</span>
                      <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>QR code not configured</p>
                    </div>
                  )}

                  <div className={styles.gcashAccount}>
                    <div className={styles.gcashNum}>{GCASH_NUMBER || '—'}</div>
                    <div className={styles.gcashOwner}>{GCASH_NAME}</div>
                  </div>
                </div>

                <div className={styles.refSection}>
                  <label className={styles.refLabel}>GCash Reference Number</label>
                  <input
                    className={styles.refInput}
                    type="text"
                    placeholder="e.g. 1234567890123"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    maxLength={50}
                    disabled={submitting}
                  />
                  {submitError && <p className={styles.refError}>{submitError}</p>}
                </div>

                <button
                  className={styles.upgradeBtn}
                  style={{ background: modal.color, width: '100%', marginTop: '0.5rem' }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <span className={styles.btnSpinner} /> : 'I\'ve Paid – Submit Reference'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
