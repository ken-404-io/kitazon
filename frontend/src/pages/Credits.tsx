import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { Skeleton } from '../components/ui/Skeleton';
import api from '../services/api';

interface CreditsData { credits: number; php_per_credit: number; }
interface StatsData   { balance: number; }

export default function Credits() {
  const { showToast } = useToast();
  const { getSetting } = useSettings();
  const PHP_PER_CREDIT = Number(getSetting('credit_php_per_credit', '25'));
  const [credits,    setCredits]    = useState<number | null>(null);
  const [balance,    setBalance]    = useState<number | null>(null);
  const [convertAmt, setConvertAmt] = useState('');
  const [loading,    setLoading]    = useState(false);

  const load = () => {
    api.get<CreditsData>('/credits').then(r => setCredits(r.data.credits)).catch(() => {});
    api.get<StatsData>('/auth/me/stats').then(r => setBalance(Number(r.data.balance))).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const creditInput    = Math.max(0, Math.floor(Number(convertAmt) || 0));
  const phpToSpend     = creditInput * PHP_PER_CREDIT;
  const canConvert     = creditInput >= 1 && balance !== null && phpToSpend <= balance;

  const handleConvert = async () => {
    if (!canConvert) return;
    setLoading(true);
    try {
      const res = await api.post<{ credits: number; balance: number; message: string }>('/credits/convert', { amount: phpToSpend, credits: creditInput });
      showToast(res.data.message, 'success');
      setCredits(res.data.credits);
      setBalance(res.data.balance);
      setConvertAmt('');
    } catch (err: unknown) {
      showToast((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Conversion failed.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="page-container" style={{ maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '1.25rem 0 1rem', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', color: '#60a5fa' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9.5a3.5 3.5 0 1 0-3 5.5"/>
          </svg>
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>Withdrawal Credits</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Credits are required to make withdrawals · 1 credit = withdraw ₱1</p>
      </div>

      {/* Balance card */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a2e4a 100%)', borderRadius: 20, padding: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Credits Available</p>
        <p style={{ fontSize: '2.5rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>
          {credits === null ? <Skeleton height={44} width={100} style={{ margin: '0 auto' }} /> : credits.toLocaleString()}
        </p>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
          {balance === null
            ? <Skeleton height={12} width={140} style={{ margin: '6px auto 0' }} />
            : `PHP Balance: ₱${Number(balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
        </p>
      </div>

      {/* How to earn */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <p style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.75rem' }}>How to Earn Credits</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[
            { icon: '📅', label: 'Daily Check-in',  desc: '+1 credit per check-in',        color: '#f59e0b' },
            { icon: '💱', label: 'Convert Balance',  desc: '₱25 = 1 credit',                color: '#60a5fa' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.65rem 0.75rem', background: 'var(--surface)', borderRadius: 12 }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: '0.82rem' }}>{item.label}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.desc}</p>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: item.color }}>Earn</span>
            </div>
          ))}
        </div>
      </div>

      {/* Convert card */}
      <div className="card">
        <p style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>Convert Balance → Credits</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Enter how many credits you want · 1 credit costs ₱{PHP_PER_CREDIT}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
            <span style={{ padding: '0 0 0 14px', color: '#60a5fa', fontWeight: 700, fontSize: '0.9rem' }}>CR</span>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 5"
              value={convertAmt}
              onChange={e => setConvertAmt(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.7rem 0.75rem', fontSize: '0.9rem', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          <button
            className="btn-primary"
            style={{ whiteSpace: 'nowrap', padding: '0.7rem 1.1rem', fontSize: '0.82rem', borderRadius: 12, opacity: canConvert && !loading ? 1 : 0.45 }}
            disabled={!canConvert || loading}
            onClick={handleConvert}
          >
            {loading ? '…' : 'Convert'}
          </button>
        </div>

        {/* Live preview */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--surface)', borderRadius: 10 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {creditInput > 0 ? `${creditInput} credit${creditInput !== 1 ? 's' : ''}` : '0 credits'} =
          </span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: creditInput > 0 ? '#f97316' : 'var(--text-muted)' }}>
            ₱{phpToSpend.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {creditInput > 0 && balance !== null && phpToSpend > balance && (
          <p style={{ fontSize: '0.72rem', color: 'var(--red)', marginTop: 6 }}>
            Insufficient balance — you need ₱{phpToSpend.toLocaleString('en-PH', { minimumFractionDigits: 2 })} but only have ₱{Number(balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

    </div>
  );
}
