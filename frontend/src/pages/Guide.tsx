import { useAuth } from '../context/AuthContext';

const LOCKER_URL = process.env.REACT_APP_CPALEAD_FILE_LOCKER_URL;

export default function Guide() {
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
          <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 16 }}>Free Earning Guide</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 10 }}>
            Complete one offer to unlock the "How to Earn Fast on Kitazon" guide.
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Instant access after offer completion.
        </span>
      </div>

      {/* Locker iframe */}
      {src ? (
        <iframe
          src={src}
          style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
          title="Earning Guide Locker"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation allow-modals"
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Guide locker not configured yet.
        </div>
      )}
    </div>
  );
}
