import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Skeleton } from '../components/ui/Skeleton';

type Network = 'cpalead' | 'lootably' | 'offertoro' | 'adscend';

interface NetworkConfig {
  name: string;
  description: string;
  color: string;
  getUrl: (userId: number) => string;
  envKey: string;
}

const NETWORKS: Record<Network, NetworkConfig> = {
  cpalead: {
    name: 'CPAlead',
    description: 'Surveys, app installs, and trial offers',
    color: '#f59e0b',
    envKey: 'REACT_APP_CPALEAD_PUB_ID',
    getUrl: (uid) => `https://cpalead.com/dashboard/reports/offerwall/?id=${process.env.REACT_APP_CPALEAD_PUB_ID}&format=iframe&user_id=${uid}`,
  },
  lootably: {
    name: 'Lootably',
    description: 'Mobile games, videos, and surveys',
    color: '#7c3aed',
    envKey: 'REACT_APP_LOOTABLY_APP_TOKEN',
    getUrl: (uid) => `https://wall.lootably.com/?placementID=${process.env.REACT_APP_LOOTABLY_APP_TOKEN}&uid=${uid}`,
  },
  offertoro: {
    name: 'OfferToro',
    description: 'High-paying app installs and surveys',
    color: '#0ea5e9',
    envKey: 'REACT_APP_OFFERTORO_SITE_ID',
    getUrl: (uid) => `https://www.offertoro.com/ifr/show/${process.env.REACT_APP_OFFERTORO_SITE_ID}/${uid}/21562`,
  },
  adscend: {
    name: 'Adscend Media',
    description: 'Video ads, content lockers, and surveys',
    color: '#10b981',
    envKey: 'REACT_APP_ADSCEND_PUB_ID',
    getUrl: (uid) => `https://adscendmedia.com/offerwall/?pubid=${process.env.REACT_APP_ADSCEND_PUB_ID}&subid=${uid}`,
  },
};

interface AffiliateStats { total: number; completed_offers: number; }

export default function Offers() {
  const { user } = useAuth();
  const [active, setActive] = useState<Network | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    api.get<AffiliateStats>('/affiliate/earnings')
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  const configured = (Object.entries(NETWORKS) as [Network, NetworkConfig][]).filter(
    ([, cfg]) => !!process.env[cfg.envKey]
  );

  const unconfigured = (Object.entries(NETWORKS) as [Network, NetworkConfig][]).filter(
    ([, cfg]) => !process.env[cfg.envKey]
  );

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1>Earn with Offers</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          Complete sponsored offers — surveys, app installs, and more — to earn real ₱ instantly.
        </p>
      </div>

      {/* Stats */}
      <div className="grid-2" style={{ marginBottom: '2rem', maxWidth: 480 }}>
        {loadingStats ? (
          <><Skeleton height={64} /><Skeleton height={64} /></>
        ) : (
          <>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gold)' }}>₱{Number(stats?.total ?? 0).toFixed(2)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Earned from offers</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gold)' }}>{stats?.completed_offers ?? 0}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Offers completed</div>
            </div>
          </>
        )}
      </div>

      {/* How it works */}
      <div className="card" style={{ marginBottom: '2rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>How it works</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          {['1. Pick an offer from any network below', '2. Complete it inside the iframe (survey, install, video, etc.)', '3. Your ₱ balance is credited automatically within 1–5 minutes', '4. Withdraw to GCash, Maya, or your bank'].map((s) => (
            <div key={s} style={{ color: 'var(--text-muted)' }}>{s}</div>
          ))}
        </div>
      </div>

      {/* Active networks */}
      {configured.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Available Offer Walls</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {configured.map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setActive(active === key ? null : key)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: `2px solid ${active === key ? cfg.color : 'var(--dark-border)'}`,
                  background: active === key ? `${cfg.color}22` : 'transparent',
                  color: active === key ? cfg.color : 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {cfg.name}
              </button>
            ))}
          </div>

          {active && configured.find(([k]) => k === active) && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--dark-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{NETWORKS[active].name}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>{NETWORKS[active].description}</span>
                </div>
                <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 4 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <iframe
                src={NETWORKS[active].getUrl(user?.id ?? 0)}
                style={{ width: '100%', height: 600, border: 'none', display: 'block' }}
                title={NETWORKS[active].name}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
              />
            </div>
          )}
        </div>
      )}

      {/* Setup instructions (shown when no networks configured) */}
      {configured.length === 0 && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--gold)' }}>Setup Required</h3>
          <p style={{ fontSize: 14, marginBottom: '1rem', color: 'var(--text-muted)' }}>
            To activate offers, sign up for one or more networks and add your keys to <code>frontend/.env</code> and <code>backend/.env</code>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {unconfigured.map(([key, cfg]) => (
              <div key={key} style={{ border: `1px solid ${cfg.color}44`, borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: cfg.color, marginBottom: 4 }}>{cfg.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{cfg.description}</div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 6, lineHeight: 1.8 }}>
                  {key === 'cpalead' && <>Sign up at <strong>cpalead.com</strong> → Publisher → Offerwall<br />Add to frontend/.env: REACT_APP_CPALEAD_PUB_ID=your_pub_id<br />Add to backend/.env: CPALEAD_SECRET=your_secret<br />Postback URL: https://yourdomain.com/api/affiliate/postback/cpalead?user_id={'{'}{'}' }userid{'}'}&amount={'{'}{'}' }revenue{'}'}&offer_id={'{'}{'}' }offerid{'}'}&secret=your_secret</>}
                  {key === 'lootably' && <>Sign up at <strong>lootably.com</strong> → Create App<br />Add to frontend/.env: REACT_APP_LOOTABLY_APP_TOKEN=your_token<br />Add to backend/.env: LOOTABLY_SECRET=your_secret<br />Postback URL: https://yourdomain.com/api/affiliate/postback/lootably</>}
                  {key === 'offertoro' && <>Sign up at <strong>offertoro.com</strong> → Add Site<br />Add to frontend/.env: REACT_APP_OFFERTORO_SITE_ID=your_site_id<br />Add to backend/.env: OFFERTORO_SECRET=your_secret<br />Postback URL: https://yourdomain.com/api/affiliate/postback/offertoro</>}
                  {key === 'adscend' && <>Sign up at <strong>adscendmedia.com</strong> → Publisher<br />Add to frontend/.env: REACT_APP_ADSCEND_PUB_ID=your_pub_id<br />Add to backend/.env: ADSCEND_SECRET=your_secret<br />Postback URL: https://yourdomain.com/api/affiliate/postback/adscend</>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
