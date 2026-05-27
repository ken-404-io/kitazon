import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import styles from './KitaGrow.module.css';

interface Term { term_days: number; multiplier: number; return_pct: number; }
interface Investment {
  id: number; term_days: number; amount: number | string; payout_amount: number | string;
  reference: string; status: 'pending' | 'active' | 'matured' | 'rejected';
  admin_note: string | null; activated_at: string | null; matures_at: string | null;
  paid_out_at: string | null; created_at: string;
}
interface KgWithdrawal {
  id: number; amount: number | string; channel: string; account_number: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected'; admin_note: string | null; created_at: string;
}
interface Config { min: number; max: number; enabled: boolean; gcash_number: string; gcash_name: string; gcash_qr: string; }
interface Overview {
  wallet_balance: number;
  config: Config;
  terms: Term[];
  withdraw_min: number;
  investments: Investment[];
  withdrawals: KgWithdrawal[];
  summary: { active_principal: number; expected_payout: number; total_earned: number };
}

const peso = (n: number | string, dec = 2) =>
  '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: dec, maximumFractionDigits: dec });

function maturityLabel(inv: Investment): string {
  if (!inv.matures_at) return '';
  const ms = new Date(inv.matures_at).getTime() - Date.now();
  if (ms <= 0) return 'Maturing…';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m left`;
}

const WHY = [
  { icon: '🛡️', title: 'Safe & Secure', desc: 'Your funds are protected.' },
  { icon: '📈', title: 'Attractive Returns', desc: 'Higher returns for longer terms.' },
  { icon: '🗓️', title: 'Flexible Terms', desc: 'Choose the plan that fits you.' },
  { icon: '⏱️', title: 'On-Time Payouts', desc: 'Payouts processed on time.' },
  { icon: '👥', title: 'Trusted Platform', desc: 'Backed by thousands of Kitazon users.' },
];

const badgeClass: Record<string, string> = {
  pending: styles.bPending, active: styles.bActive, matured: styles.bMatured,
  rejected: styles.bRejected, completed: styles.bCompleted, processing: styles.bProcessing,
};

export default function KitaGrow() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [investTerm, setInvestTerm] = useState<Term | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const reload = () => { setLoading(true); setReloadKey(k => k + 1); };

  useEffect(() => {
    let active = true;
    api.get<Overview>('/investments')
      .then(r => { if (active) setData(r.data); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  if (loading) {
    return <div className={styles.kg}><p className={styles.empty} style={{ paddingTop: '5rem' }}>Loading KitaGrow…</p></div>;
  }
  if (!data) {
    return <div className={styles.kg}><p className={styles.empty} style={{ paddingTop: '5rem' }}>Could not load KitaGrow. Please try again.</p></div>;
  }

  const { config, terms, summary } = data;
  const activeInvestments = data.investments.filter(i => i.status === 'active' || i.status === 'pending');
  const canWithdraw = Number(data.wallet_balance) >= data.withdraw_min;

  return (
    <div className={styles.kg}>
      {/* ── Hero ── */}
      <header className={styles.hero}>
        <span className={styles.leaf}>🌱</span>
        <div className={styles.heroInner}>
          <span className={styles.heroBrand}>
            <span className={styles.heroBadge}>KZ</span> kitazon.com · KitaGrow
          </span>
          <h1 className={styles.heroTitle}>Invest Today,<br /><span>Grow Tomorrow!</span></h1>
          <p className={styles.heroTag}>Palaguin ang pera mo. Palaguin ang kita mo. Choose a plan, invest via GCash, and watch your money grow.</p>
        </div>
      </header>

      <div className={styles.inner}>
        {/* ── Wallet ── */}
        <div className={styles.walletCard}>
          <div className={styles.walletMain}>
            <div className={styles.walletLabel}>KitaGrow Wallet</div>
            <div className={styles.walletBalance}>{peso(data.wallet_balance)}</div>
            <div className={styles.walletSub}>Matured payouts land here — withdraw anytime via GCash.</div>
          </div>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <div className={styles.statVal}>{peso(summary.active_principal, 0)}</div>
              <div className={styles.statLab}>Active</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{peso(summary.expected_payout, 0)}</div>
              <div className={styles.statLab}>Expected</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statVal}>{peso(summary.total_earned, 0)}</div>
              <div className={styles.statLab}>Earned</div>
            </div>
          </div>
          <button className={styles.primaryBtn} disabled={!canWithdraw} onClick={() => setShowWithdraw(true)}>
            Withdraw
          </button>
        </div>
        {!canWithdraw && (
          <p className={styles.note} style={{ marginTop: '0.6rem' }}>
            Minimum withdrawal is {peso(data.withdraw_min, 0)}. Invest and let a plan mature to grow your wallet.
          </p>
        )}

        {/* ── Plans ── */}
        <div className={styles.sectionTitle}>Choose Your Investment Plan</div>
        <div className={styles.plans}>
          {terms.map(t => {
            const example = Math.round(config.min * t.multiplier);
            return (
              <div key={t.term_days} className={styles.planCard}>
                <div>
                  <span className={styles.planDays}>{t.term_days}</span>{' '}
                  <span className={styles.planDaysUnit}>DAYS</span>
                </div>
                <div className={styles.planSub}>Investment Plan</div>
                <div className={styles.planReturnPill}>
                  {t.return_pct}%
                  <small>RETURN</small>
                </div>
                <div className={styles.planExample}>
                  Invest {peso(config.min, 0)} → get <b>{peso(example, 0)}</b>
                </div>
                <button className={styles.primaryBtn} disabled={!config.enabled} onClick={() => setInvestTerm(t)}>
                  Invest Now
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Your investments ── */}
        {activeInvestments.length > 0 && (
          <>
            <div className={styles.sectionTitle}>Your Investments</div>
            <div className={styles.list}>
              {activeInvestments.map(inv => (
                <div key={inv.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>
                      {inv.term_days}-Day Plan <span className={`${styles.badge} ${badgeClass[inv.status]}`}>{inv.status}</span>
                    </div>
                    <div className={styles.rowMeta}>
                      Invested {peso(inv.amount, 0)} · Ref {inv.reference}
                      {inv.status === 'active' && inv.matures_at && <> · <span className={styles.countdown}>{maturityLabel(inv)}</span></>}
                      {inv.status === 'pending' && <> · awaiting admin approval</>}
                    </div>
                  </div>
                  <div className={styles.rowAmt}>
                    <div className={styles.rowAmtVal}>{peso(inv.payout_amount, 0)}</div>
                    <div className={styles.rowAmtLab}>payout</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Why ── */}
        <div className={styles.sectionTitle}>Why Invest in KitaGrow?</div>
        <div className={styles.why}>
          {WHY.map(w => (
            <div key={w.title} className={styles.whyItem}>
              <div className={styles.whyIcon}>{w.icon}</div>
              <div className={styles.whyTitle}>{w.title}</div>
              <div className={styles.whyDesc}>{w.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Withdrawal history ── */}
        {data.withdrawals.length > 0 && (
          <>
            <div className={styles.sectionTitle}>Withdrawal History</div>
            <div className={styles.list}>
              {data.withdrawals.map(w => (
                <div key={w.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>
                      {peso(w.amount, 0)} <span className={`${styles.badge} ${badgeClass[w.status]}`}>{w.status}</span>
                    </div>
                    <div className={styles.rowMeta}>
                      GCash {w.account_number} · {new Date(w.created_at).toLocaleDateString('en-PH')}
                      {w.admin_note && <> · {w.admin_note}</>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className={styles.note}>
          All investments are processed via GCash and verified by our team within 24 hours. Returns are credited to your KitaGrow wallet at the end of the term.
        </p>
      </div>

      {investTerm && (
        <InvestModal
          term={investTerm}
          config={config}
          onClose={() => setInvestTerm(null)}
          onDone={() => { setInvestTerm(null); reload(); }}
        />
      )}
      {showWithdraw && (
        <WithdrawModal
          balance={Number(data.wallet_balance)}
          min={data.withdraw_min}
          onClose={() => setShowWithdraw(false)}
          onDone={() => { setShowWithdraw(false); reload(); }}
        />
      )}
    </div>
  );
}

/* ── Invest modal ──────────────────────────────────────────────────────────── */
function InvestModal({ term, config, onClose, onDone }: {
  term: Term; config: Config; onClose: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState<string>(String(config.min));
  const [reference, setReference] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const amt = Number(amount);
  const payout = useMemo(() => (amt > 0 ? Math.round(amt * term.multiplier * 100) / 100 : 0), [amt, term.multiplier]);

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Screenshot must be under 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setError('');
    if (!amt || amt < config.min) { setError(`Minimum investment is ${peso(config.min, 0)}.`); return; }
    if (amt > config.max) { setError(`Maximum investment is ${peso(config.max, 0)}.`); return; }
    if (reference.trim().length < 5) { setError('Please enter your GCash reference number.'); return; }
    setSubmitting(true);
    try {
      await api.post('/investments', {
        term_days: term.term_days,
        amount: amt,
        reference: reference.trim(),
        ...(screenshot ? { screenshot_data: screenshot } : {}),
      });
      setDone(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className={styles.overlay} onClick={() => !submitting && onClose()}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={() => !submitting && onClose()}>✕</button>

        {done ? (
          <div className={styles.successWrap}>
            <div className={styles.successIcon}>✓</div>
            <h3 className={styles.modalTitle}>Investment Submitted!</h3>
            <p className={styles.modalSub}>Our team will verify your GCash payment and activate your {term.term_days}-day plan within 24 hours.</p>
            <button className={styles.primaryBtn} onClick={onDone}>Got it</button>
          </div>
        ) : (
          <>
            <div className={styles.modalTitle}>{term.term_days}-Day Plan · {term.return_pct}% return</div>
            <div className={styles.modalSub}>Enter your amount, pay via GCash, then submit your reference number.</div>

            <div className={styles.field}>
              <label className={styles.label}>Investment Amount ({peso(config.min, 0)}–{peso(config.max, 0)})</label>
              <input className={styles.input} type="number" min={config.min} max={config.max} value={amount}
                onChange={e => setAmount(e.target.value)} disabled={submitting} />
            </div>

            <div className={styles.payoutPreview}>
              <div>
                <div className={styles.pp1}>You receive after {term.term_days} days</div>
              </div>
              <div className={styles.pp2}>{peso(payout, 0)}</div>
            </div>

            <div className={styles.qrBox}>
              <div className={styles.label} style={{ marginBottom: 8 }}>Pay {peso(amt || config.min, 0)} via GCash</div>
              {config.gcash_qr
                ? <img className={styles.qrImg} src={config.gcash_qr} alt="GCash QR" />
                : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scan / send to the GCash number below</div>}
              <div className={styles.qrAcct}>{config.gcash_number || '—'}</div>
              <div className={styles.qrName}>{config.gcash_name}</div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>GCash Reference Number</label>
              <input className={styles.input} type="text" placeholder="e.g. 1234567890123" value={reference}
                onChange={e => setReference(e.target.value)} maxLength={50} disabled={submitting} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Receipt Screenshot (optional)</label>
              <label className={styles.uploadBox}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScreenshot} disabled={submitting} />
                {screenshot ? <img className={styles.uploadPreview} src={screenshot} alt="receipt" /> : <>📷 Tap to attach receipt</>}
              </label>
            </div>

            {error && <p className={styles.err}>{error}</p>}
            <button className={styles.primaryBtn} style={{ width: '100%' }} onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : "I've Paid – Submit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Withdraw modal ────────────────────────────────────────────────────────── */
function WithdrawModal({ balance, min, onClose, onDone }: {
  balance: number; min: number; onClose: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState<string>(String(Math.floor(balance)));
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError('');
    const amt = Number(amount);
    if (!amt || amt < min) { setError(`Minimum withdrawal is ${peso(min, 0)}.`); return; }
    if (amt > balance) { setError('Amount exceeds your KitaGrow wallet balance.'); return; }
    setSubmitting(true);
    try {
      await api.post('/investments/withdraw', { amount: amt, account_number: account.trim(), account_name: name.trim() });
      setDone(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className={styles.overlay} onClick={() => !submitting && onClose()}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={() => !submitting && onClose()}>✕</button>

        {done ? (
          <div className={styles.successWrap}>
            <div className={styles.successIcon}>✓</div>
            <h3 className={styles.modalTitle}>Withdrawal Requested!</h3>
            <p className={styles.modalSub}>Our team will process your GCash payout shortly.</p>
            <button className={styles.primaryBtn} onClick={onDone}>Got it</button>
          </div>
        ) : (
          <>
            <div className={styles.modalTitle}>Withdraw from KitaGrow</div>
            <div className={styles.modalSub}>Available: <b>{peso(balance)}</b> · paid out via GCash by our team.</div>

            <div className={styles.field}>
              <label className={styles.label}>Amount</label>
              <input className={styles.input} type="number" min={min} max={balance} value={amount}
                onChange={e => setAmount(e.target.value)} disabled={submitting} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>GCash Mobile Number</label>
              <input className={styles.input} type="text" placeholder="09171234567" value={account}
                onChange={e => setAccount(e.target.value)} disabled={submitting} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>GCash Account Name</label>
              <input className={styles.input} type="text" placeholder="Full name on your GCash" value={name}
                onChange={e => setName(e.target.value)} disabled={submitting} />
            </div>

            {error && <p className={styles.err}>{error}</p>}
            <button className={styles.primaryBtn} style={{ width: '100%' }} onClick={submit} disabled={submitting}>
              {submitting ? 'Requesting…' : 'Request Withdrawal'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
