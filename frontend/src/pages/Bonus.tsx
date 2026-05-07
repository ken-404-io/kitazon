import { useAuth } from '../context/AuthContext';

const LOCKER_URL = process.env.REACT_APP_CPALEAD_LINK_LOCKER_URL;

export default function Bonus() {
  const { user } = useAuth();

  const src = LOCKER_URL
    ? `${LOCKER_URL}${LOCKER_URL.includes('?') ? '&' : '?'}subid=${user?.id ?? 0}`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px - 64px)' }}>
      {/* Header bar */}
      <div style={{
        padding: '0.75rem 1.25rem',
        borderBottom: '1px solid var(--dark-border)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 16 }}>Claim Bonus ₱20</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 10 }}>
            Complete one offer to unlock a one-time ₱20 bonus credited to your balance.
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Balance credited automatically within 1–5 minutes.
        </span>
      </div>

      {/* Locker iframe */}
      {src ? (
        <iframe
          src={src}
          style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
          title="Bonus Claim Locker"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation allow-modals"
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Bonus locker not configured yet.
        </div>
      )}
    </div>
  );
}
