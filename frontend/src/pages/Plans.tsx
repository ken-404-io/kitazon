import { useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { UserPlan } from '../types';
import api from '../services/api';
import styles from './Plans.module.css';

const ic = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const FreeIcon    = () => <svg {...ic}><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>;
const SilverIcon  = () => <svg {...ic}><circle cx="12" cy="8" r="4"/><path d="M8 14l-2 7h12l-2-7"/><path d="M10 14l.5 3.5M14 14l-.5 3.5"/></svg>;
const GoldIcon    = () => <svg {...ic}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const DiamondIcon = () => <svg {...ic}><polygon points="12 2 22 9 18 20 6 20 2 9"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="12" y1="2" x2="6" y2="20"/><line x1="12" y1="2" x2="18" y2="20"/></svg>;

const STATIC_PLANS: {
  plan: UserPlan;
  name: string;
  badge: ReactNode;
  color: string;
  features: string[];
}[] = [
  {
    plan:     'free',
    name:     'Free',
    badge:    <FreeIcon />,
    color:    'var(--text-muted)',
    features: ['2 invites to withdraw', '40 correct answers to withdraw', 'GCash withdrawals', 'Task earnings', 'Referral bonuses'],
  },
  {
    plan:     'silver',
    name:     'Silver',
    badge:    <SilverIcon />,
    color:    '#9ca3af',
    features: ['1 invite to withdraw', '20 correct answers to withdraw', 'Choose your withdrawal amount', 'Priority support'],
  },
  {
    plan:     'gold',
    name:     'Gold',
    badge:    <GoldIcon />,
    color:    '#f59e0b',
    features: ['No quiz required to withdraw', 'No invite required', 'Choose your withdrawal amount', 'Priority support'],
  },
  {
    plan:     'diamond',
    name:     'Diamond',
    badge:    <DiamondIcon />,
    color:    '#60a5fa',
    features: ['No credits needed to withdraw', 'No quiz required', 'No invite required', 'Choose your withdrawal amount', 'VIP support'],
  },
];

export default function Plans() {
  const { user } = useAuth();
  const { getSetting } = useSettings();
  const currentPlan = user?.plan ?? 'free';

  const GCASH_NUMBER = getSetting('gcash_number', '');
  const GCASH_NAME   = getSetting('gcash_name', 'Kitazon');
  const GCASH_QR: Record<string, string> = {
    silver:  getSetting('gcash_qr_silver', 'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935459/4432f02f-79d9-4bf7-bd8f-39f0b63487ad_qbjxzx.jpg'),
    gold:    getSetting('gcash_qr_gold',   'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935610/1593c9bc-c490-4854-826d-72ad2a5a79a1_cwdk3l.jpg'),
    diamond: getSetting('gcash_qr_diamond','https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935570/69504c45-6f87-43b1-aebe-83d55a30e5be_p6tncl.jpg'),
  };

  const PLANS = STATIC_PLANS.map(p => {
    const priceNum = p.plan === 'free' ? 0 : Number(getSetting(`plan_price_${p.plan}`, '0'));
    const dailyLimit = Number(getSetting(`plan_limit_${p.plan}`, '0'));
    const price = p.plan === 'free' ? 'Free' : `₱${priceNum.toLocaleString()}/mo`;
    return { ...p, priceNum, dailyLimit, price };
  });

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
                <span className={styles.planIcon} style={{ color: p.color }}>{p.badge}</span>
                <div>
                  <h2 className={styles.planName} style={{ color: p.color }}>{p.name}</h2>
                  <p className={styles.planPrice}>{p.price}</p>
                </div>
              </div>

              <p className={styles.limitLine}>
                <span className={styles.limitAmt} style={{ color: p.color }}>₱{p.dailyLimit}</span>
                <span className={styles.limitLabel}>max per request</span>
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
                <div className={styles.reviewingBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Reviewing…
                </div>
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
                  <span style={{ color: modal.color, display: 'flex' }}>{modal.badge}</span>
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
                  {/* Step-by-step guide */}
                  <div className={styles.stepsBox}>
                    <p className={styles.stepsTitle}>How to Pay</p>
                    {[
                      { n: 1, text: 'Screenshot or long-press the QR code above to save it.' },
                      { n: 2, text: 'Open GCash → tap "Pay QR" → tap the upload icon → select the saved QR.' },
                      { n: 3, text: 'Confirm and complete the payment in GCash.' },
                      { n: 4, text: 'Come back here, upload your receipt and enter the reference number below.' },
                    ].map(s => (
                      <div key={s.n} className={styles.stepRow}>
                        <span className={styles.stepNum}>{s.n}</span>
                        <span className={styles.stepText}>{s.text}</span>
                      </div>
                    ))}
                  </div>

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
