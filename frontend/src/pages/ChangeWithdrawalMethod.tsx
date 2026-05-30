import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import styles from './Withdraw.module.css';

const sz = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const BackIcon  = () => <svg {...sz}><polyline points="15 18 9 12 15 6"/></svg>;
const LockIcon  = () => <svg {...sz} width={16} height={16}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const AlertIcon = () => <svg {...sz} width={16} height={16}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

interface SavedAccount {
  account_number: string;
  account_name?: string | null;
  channel: string;
}

interface ChangeRequest {
  id: number;
  requested_number: string;
  requested_name: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.9rem', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
  fontSize: '0.88rem', outline: 'none',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChangeWithdrawalMethod() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [saved, setSaved] = useState<SavedAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<ChangeRequest | null>(null);

  // Request form
  const [reason, setReason] = useState('');
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
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

  const onPickScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) { showToast('Image too large (max 6MB).'); return; }
    try { setScreenshot(await readFileAsDataUrl(file)); }
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
      setReason(''); setNumber(''); setName(''); setScreenshot(null);
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

        {/* Current method */}
        <div className={styles.sectionCard}>
          <h4>Current Withdrawal Method</h4>
          {loading ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading…</p>
          ) : saved ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.9rem', marginBottom: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0070e0', display: 'inline-block' }} />
                <span style={{ fontWeight: 700 }}>GCash</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 20 }}>Saved</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.9rem', marginBottom: 8 }}>
                <LockIcon />
                <div style={{ flex: 1, fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>GCash number</div>
                  <div style={{ color: 'var(--text)', fontWeight: 600 }}>{saved.account_number}</div>
                </div>
              </div>
              {saved.account_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.9rem' }}>
                  <LockIcon />
                  <div style={{ flex: 1, fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Account name</div>
                    <div style={{ color: 'var(--text)', fontWeight: 600 }}>{saved.account_name}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              You don't have a saved withdrawal method yet. Submit a withdrawal to register one.
            </p>
          )}
        </div>

        {/* Request a change */}
        <div className={styles.sectionCard}>
          <h4>Request an Account Change</h4>

          {pending ? (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text)' }}>
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

              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', margin: '8px 0 4px' }}>New GCash number</label>
              <input style={inputStyle} type="tel" inputMode="numeric" placeholder="09171234567" value={number} maxLength={13} onChange={e => setNumber(e.target.value)} />

              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', margin: '10px 0 4px' }}>New account name</label>
              <input style={inputStyle} type="text" placeholder="Full name on GCash" value={name} maxLength={100} onChange={e => setName(e.target.value)} />

              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', margin: '10px 0 4px' }}>Why are you changing it?</label>
              <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} placeholder="e.g. I made a typo in my GCash number / I changed my GCash account…" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} />

              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', margin: '10px 0 4px' }}>Proof screenshot (your GCash account)</label>
              <input type="file" accept="image/*" onChange={onPickScreenshot} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} />
              {screenshot && (
                <img src={screenshot} alt="proof preview" style={{ display: 'block', marginTop: 8, maxWidth: '100%', maxHeight: 200, borderRadius: 10, border: '1.5px solid var(--border)' }} />
              )}

              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                style={{ display: 'block', width: '100%', marginTop: 14, background: 'var(--primary, #f97316)', border: 'none', color: '#fff', borderRadius: 10, padding: '0.8rem 1rem', fontSize: '0.9rem', fontWeight: 800, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Submitting…' : 'Submit Change Request'}
              </button>
            </>
          )}
        </div>

        {/* Supported methods */}
        <div className={styles.sectionCard}>
          <h4>Supported Methods</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '0.65rem 0.9rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0070e0', display: 'inline-block' }} />
            <span style={{ fontWeight: 700 }}>GCash</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>· 1–24 hrs</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <AlertIcon />
            <span>PayPal and email-based payouts are <strong>not accepted</strong>. Only GCash withdrawals are supported at this time.</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/withdraw')}
          style={{ display: 'block', width: '100%', marginTop: 10, background: 'transparent', border: '1.5px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
        >
          ← Back to Withdraw
        </button>
      </div>
    </div>
  );
}
