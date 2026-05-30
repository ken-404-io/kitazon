import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import styles from './Withdraw.module.css';

const sz = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const BackIcon  = () => <svg width={20} height={20} {...sz}><polyline points="15 18 9 12 15 6"/></svg>;
const PhoneIcon = () => <svg width={16} height={16} {...sz}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const UserIcon  = () => <svg width={16} height={16} {...sz}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const RefreshIcon = () => <svg width={16} height={16} {...sz}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
const CloudIcon = () => <svg width={26} height={26} {...sz}><path d="M16 16l-4-4-4 4"/><path d="M12 12v9"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
const SendIcon  = () => <svg width={16} height={16} {...sz}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const ClockIcon = () => <svg width={13} height={13} {...sz}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const InfoIcon  = () => <svg width={16} height={16} {...sz}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const CheckCircleIcon = () => <svg width={16} height={16} {...sz} stroke="#22c55e"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;

const ACCENT = '#a78bfa';

interface SavedAccount { account_number: string; account_name?: string | null; channel: string; }
interface ChangeRequest {
  id: number; requested_number: string; requested_name: string; reason: string;
  status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string;
}

const REASON_MAX = 500;

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.9rem 0.7rem 2.4rem', borderRadius: 12,
  border: '1.5px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)',
  fontSize: '0.88rem', outline: 'none',
};
const labelStyle: React.CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', margin: '12px 0 5px', fontWeight: 600 };
const fieldIconStyle: React.CSSProperties = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const sectionHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: ACCENT, margin: '0 0 12px' };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const GcashBadge = ({ size = 34 }: { size?: number }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', background: '#0070e0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.5, flexShrink: 0 }}>G</span>
);

export default function ChangeWithdrawalMethod() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [saved, setSaved] = useState<SavedAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<ChangeRequest | null>(null);

  // Request form
  const [reason, setReason] = useState('');
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [shotName, setShotName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api.get<SavedAccount | null>('/withdrawals/saved-account').then(res => res.data ?? null).catch(() => null),
        api.get<ChangeRequest | null>('/payment-method/change-requests/mine').then(res => res.data ?? null).catch(() => null),
      ]);
      setSaved(s);
      setRequest(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const acceptFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5MB).'); return; }
    try { setScreenshot(await readFileAsDataUrl(file)); setShotName(file.name); }
    catch { showToast('Could not read that image.'); }
  };

  const submit = async () => {
    if (reason.trim().length < 10) { showToast('Please explain why (at least 10 characters).'); return; }
    if (!number.trim()) { showToast('Enter the new GCash number.'); return; }
    if (!name.trim()) { showToast('Enter the new account name.'); return; }
    if (!screenshot) { showToast('Upload a screenshot of your GCash account as proof.'); return; }
    setSubmitting(true);
    try {
      await api.post('/payment-method/change-requests', {
        reason: reason.trim(),
        requested_number: number.trim(),
        requested_name: name.trim(),
        screenshot_data: screenshot,
      });
      showToast('Request submitted! We\'ll review it within 24 hours.');
      setReason(''); setNumber(''); setName(''); setScreenshot(null); setShotName('');
      load();
    } catch (err: unknown) {
      showToast((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const pending = request?.status === 'pending';

  return (
    <div className="page-container">
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <button className={styles.iconBtn} onClick={() => navigate('/withdraw')}><BackIcon /></button>
          <span className={styles.pageTitle}>Payment Method Management</span>
          <span style={{ width: 38 }} />
        </div>

        {/* ── Current method ── */}
        <div className={styles.sectionCard} style={{ borderColor: `${ACCENT}40` }}>
          <p style={sectionHeaderStyle}>Current Withdrawal Method</p>
          {loading ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading…</p>
          ) : saved ? (
            <div style={{ background: 'var(--dark-bg)', border: '1.5px solid var(--dark-border)', borderRadius: 12, padding: '0.85rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <GcashBadge size={30} />
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>GCash</span>
                <span style={{ flex: 1 }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '3px 9px', borderRadius: 20 }}><CheckCircleIcon /> Saved</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: 3 }}><PhoneIcon /> GCash Number</div>
                  <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem', wordBreak: 'break-all' }}>{saved.account_number}</div>
                </div>
                <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: 3 }}><UserIcon /> Account Name</div>
                  <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem' }}>{saved.account_name ?? '—'}</div>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              You don't have a saved withdrawal method yet. Submit a withdrawal to register one.
            </p>
          )}
        </div>

        {/* ── Request a change ── */}
        <div className={styles.sectionCard}>
          <p style={sectionHeaderStyle}><RefreshIcon /> Request an Account Change</p>

          {pending ? (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>⏳ Request under review</div>
              <div style={{ color: 'var(--text-muted)' }}>
                You asked to change your GCash to <strong>{request?.requested_number}</strong> ({request?.requested_name}).
                Our team will review your proof within 24 hours — you'll be notified by email.
              </div>
            </div>
          ) : (
            <>
              {request?.status === 'rejected' && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '0.7rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Your last request was not approved.{request.admin_note ? ` Reason: ${request.admin_note}` : ''} You can submit a new one below.
                </div>
              )}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, lineHeight: 1.5 }}>
                To keep accounts safe, GCash changes are reviewed by our team. Tell us why you're changing it and upload a screenshot of your GCash account (showing the name and number) as proof.
              </p>

              <label style={labelStyle}>New GCash Number</label>
              <div style={{ position: 'relative' }}>
                <span style={fieldIconStyle}><PhoneIcon /></span>
                <input style={inputBase} type="tel" inputMode="numeric" placeholder="0917 123 4567" value={number} maxLength={13} onChange={e => setNumber(e.target.value)} />
              </div>

              <label style={labelStyle}>New Account Name</label>
              <div style={{ position: 'relative' }}>
                <span style={fieldIconStyle}><UserIcon /></span>
                <input style={inputBase} type="text" placeholder="Full name on GCash" value={name} maxLength={100} onChange={e => setName(e.target.value)} />
              </div>

              <label style={labelStyle}>Why are you changing it?</label>
              <div style={{ position: 'relative' }}>
                <textarea
                  style={{ ...inputBase, paddingLeft: '0.9rem', minHeight: 76, resize: 'vertical' }}
                  placeholder="e.g. I made a typo in my GCash number / I changed my GCash account…"
                  value={reason}
                  maxLength={REASON_MAX}
                  onChange={e => setReason(e.target.value)}
                />
                <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: '0.68rem', color: 'var(--text-muted)' }}>{reason.length}/{REASON_MAX}</span>
              </div>

              <label style={labelStyle}>Proof (Screenshot of your GCash account)</label>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => acceptFile(e.target.files?.[0] ?? undefined)} />
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  border: `1.5px dashed ${dragOver ? ACCENT : 'var(--dark-border)'}`,
                  background: dragOver ? `${ACCENT}11` : 'var(--dark-bg)',
                  borderRadius: 12, padding: '0.85rem 1rem',
                }}
              >
                <span style={{ color: ACCENT }}><CloudIcon /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {shotName || 'Choose file or drag and drop'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PNG, JPG · Max 5MB</div>
                </div>
                <span style={{ border: `1.5px solid ${ACCENT}`, color: ACCENT, borderRadius: 8, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Browse</span>
              </div>
              {screenshot && (
                <img src={screenshot} alt="proof preview" style={{ display: 'block', marginTop: 10, maxWidth: '100%', maxHeight: 200, borderRadius: 10, border: '1.5px solid var(--dark-border)' }} />
              )}

              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 16, background: 'var(--primary, #f97316)', border: 'none', color: '#fff', borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.92rem', fontWeight: 800, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}
              >
                <SendIcon /> {submitting ? 'Submitting…' : 'Submit Change Request'}
              </button>
            </>
          )}
        </div>

        {/* ── Supported methods ── */}
        <div className={styles.sectionCard}>
          <p style={sectionHeaderStyle}>Supported Methods</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--dark-bg)', border: '1.5px solid var(--dark-border)', borderRadius: 12, padding: '0.7rem 0.95rem' }}>
            <GcashBadge size={28} />
            <span style={{ fontWeight: 800 }}>GCash</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}><ClockIcon /> 1–24 hrs</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: ACCENT, background: `${ACCENT}1f`, padding: '3px 9px', borderRadius: 20 }}>Supported</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><InfoIcon /></span>
            <span>PayPal and email-based payouts are <strong>not accepted</strong>. Only GCash withdrawals are supported at this time.</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/withdraw')}
          style={{ display: 'block', width: '100%', marginTop: 10, background: 'transparent', border: '1.5px solid var(--dark-border)', color: 'var(--text)', borderRadius: 12, padding: '0.8rem 1rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}
        >
          ← Back to Withdraw
        </button>
      </div>
    </div>
  );
}
