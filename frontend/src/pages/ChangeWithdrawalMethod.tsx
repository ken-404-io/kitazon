import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
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

export default function ChangeWithdrawalMethod() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [saved, setSaved] = useState<SavedAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  const loadSaved = async () => {
    setLoading(true);
    try {
      const r = await api.get<SavedAccount | null>('/withdrawals/saved-account');
      setSaved(r.data ?? null);
    } catch {
      setSaved(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSaved(); }, []);

  const removeSaved = async () => {
    if (!window.confirm('Remove your saved GCash account? You\'ll be able to register a different GCash number on your next withdrawal.')) return;
    setRemoving(true);
    try {
      await api.delete('/withdrawals/saved-account');
      setSaved(null);
      showToast('Withdrawal method removed. Register a new GCash account on your next withdrawal.', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to remove withdrawal method.';
      showToast(msg, 'error');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="page-container">
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <button className={styles.iconBtn} onClick={() => navigate('/withdraw')}><BackIcon /></button>
          <span className={styles.pageTitle}>Change Withdrawal Method</span>
          <span style={{ width: 38 }} />
        </div>

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

        {saved && (
          <button
            type="button"
            disabled={removing}
            onClick={removeSaved}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 10,
              background: 'transparent',
              border: '1.5px solid var(--red)',
              color: 'var(--red)',
              borderRadius: 10,
              padding: '0.75rem 1rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: removing ? 'not-allowed' : 'pointer',
              opacity: removing ? 0.6 : 1,
            }}
          >
            {removing ? 'Removing…' : 'Remove & Register a Different GCash Account'}
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate('/withdraw')}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 10,
            background: 'transparent',
            border: '1.5px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 10,
            padding: '0.75rem 1rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Back to Withdraw
        </button>
      </div>
    </div>
  );
}
