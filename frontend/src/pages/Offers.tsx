import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Skeleton } from '../components/ui/Skeleton';

interface AffiliateStats { total: number; completed_offers: number; }

const CPALEAD_URL = (uid: number) =>
  `https://www.zwidgetymz56r.xyz/list/${process.env.REACT_APP_CPALEAD_PUB_ID}?subid=${uid}`;

export default function Offers() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    api.get<AffiliateStats>('/affiliate/earnings')
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1.25rem',
        borderBottom: '1px solid var(--dark-border)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Earned from offers: </span>
          {loadingStats ? <Skeleton height={18} width={60} /> : (
            <span style={{ fontWeight: 700, color: 'var(--gold)' }}>₱{Number(stats?.total ?? 0).toFixed(2)}</span>
          )}
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--dark-border)' }} />
        <div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Completed: </span>
          {loadingStats ? <Skeleton height={18} width={30} /> : (
            <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{stats?.completed_offers ?? 0}</span>
          )}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          Balance credited automatically within 1–5 minutes after completing an offer.
        </div>
      </div>

      {/* Full-page offerwall */}
      {process.env.REACT_APP_CPALEAD_PUB_ID ? (
        <iframe
          src={CPALEAD_URL(user?.id ?? 0)}
          style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
          title="CPAlead Offerwall"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Offerwall not configured.
        </div>
      )}
    </div>
  );
}
