import { useEffect, useState } from 'react';
import api from '../services/api';
import { Skeleton } from '../components/ui/Skeleton';
import { TrophyIcon, MedalIcon } from '../components/ui/Icons';

interface Leader {
  rank: number;
  name: string;
  referral_count: number;
  total_earned: number;
}

const MEDAL_COLORS = ['#f59e0b', '#9ca3af', '#b45309'];

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Leader[]>('/referrals/leaderboard')
      .then((r) => setLeaders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ color: 'var(--gold)' }}><TrophyIcon /></span>
        <h1>Referral Leaderboard</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Top earners from referrals this month</p>

      {loading ? (
        Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Skeleton height={36} width={36} borderRadius="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton height={16} width="40%" />
              <Skeleton height={12} width="25%" />
            </div>
            <Skeleton height={24} width={70} />
          </div>
        ))
      ) : leaders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No referral data yet. Start referring friends to appear here!
        </div>
      ) : (
        leaders.map((l) => (
          <div key={l.rank} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <div style={{ minWidth: 36, textAlign: 'center', color: l.rank <= 3 ? MEDAL_COLORS[l.rank - 1] : 'var(--text-muted)', fontWeight: 700, fontSize: l.rank <= 3 ? 14 : 14 }}>
              {l.rank <= 3
                ? <span style={{ color: MEDAL_COLORS[l.rank - 1] }}><MedalIcon /></span>
                : <span>#{l.rank}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{l.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{l.referral_count} referral{l.referral_count !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--gold)' }}>₱{Number(l.total_earned).toFixed(2)}</div>
          </div>
        ))
      )}
    </div>
  );
}
