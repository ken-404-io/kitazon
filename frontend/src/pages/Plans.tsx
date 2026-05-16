import { useState, useEffect } from 'react';
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

const GCASH_QR: Record<string, string> = {
  silver:  'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935459/4432f02f-79d9-4bf7-bd8f-39f0b63487ad_qbjxzx.jpg',
  gold:    'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935610/1593c9bc-c490-4854-826d-72ad2a5a79a1_cwdk3l.jpg',
  diamond: 'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935570/69504c45-6f87-43b1-aebe-83d55a30e5be_p6tncl.jpg',
};

const GCASH_NUMBER   = process.env.REACT_APP_GCASH_NUMBER   ?? '';
const GCASH_NAME     = process.env.REACT_APP_GCASH_NAME     ?? 'Kitazon';

export default function Plans() {
  const { user } = useAuth();
  const currentPlan = user?.plan ?? 'free';

  const [pendingPlans, setPendingPlans] = useState<string[]>([]);

  useEffect(() => {
    api.get<{ pending_plans: string[] }>('/subscriptions/gcash-pending')
      .then(r => setPendingPlans(r.data.pending_plans))
      .catch(() => {});
  }, []);

  const [modal, setModal] = useState<typeof PLANS[number] | null>(null);
  const [reference, setReference] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const openModal = (p: typeof PLANS[number]) => {
    setModal(p);
    setReference('');
    setScreenshot(null);
    setSubmitError('');
    setSubmitted(false);
  };

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setSubmitError('Screenshot must be under 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
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
      await api.post('/subscriptions/gcash-submit', {
        plan: modal.plan,
        reference: reference.trim(),
        ...(screenshot ? { screenshot_data: screenshot } : {}),
      });
      setSubmitted(true);
      setPendingPlans(prev => [...prev, modal.plan]);
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
              ) : pendingPlans.includes(p.plan) ? (
                <div className={styles.reviewingBtn}>⏳ Reviewing…</div>
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

                  {GCASH_QR[modal.plan] ? (
                    <div className={styles.qrWrapper}>
                      <img src={GCASH_QR[modal.plan]} alt={`${modal.name} GCash QR Code`} className={styles.qrImage} />
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

                  <label className={styles.refLabel} style={{ marginTop: '0.75rem' }}>
                    Screenshot / Receipt <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional but recommended)</span>
                  </label>
                  <label className={styles.screenshotUpload}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleScreenshot}
                      disabled={submitting}
                    />
                    {screenshot ? (
                      <img src={screenshot} alt="Receipt preview" className={styles.screenshotPreview} />
                    ) : (
                      <div className={styles.screenshotPlaceholder}>
                        <span style={{ fontSize: '1.5rem' }}>📷</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tap to attach receipt</span>
                      </div>
                    )}
                  </label>
                  {screenshot && (
                    <button
                      className={styles.removeScreenshot}
                      onClick={() => setScreenshot(null)}
                      disabled={submitting}
                      type="button"
                    >
                      Remove photo
                    </button>
                  )}

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
