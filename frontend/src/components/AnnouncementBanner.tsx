import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

const SESSION_KEY = 'announcement_dismissed';

export default function AnnouncementBanner() {
  const { getSetting } = useSettings();
  const text  = getSetting('announcement_text', '');
  const color = getSetting('announcement_color', '#f59e0b');
  const [dismissed, setDismissed] = useState(false);

  // Re-evaluate sessionStorage whenever text changes (new session or new message)
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    setDismissed(stored === text && text !== '');
  }, [text]);

  if (!text || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, text);
    setDismissed(true);
  };

  return (
    <div style={{
      width: '100%',
      background: color,
      color: '#000',
      padding: '0.55rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontSize: '0.85rem',
      fontWeight: 600,
      boxSizing: 'border-box',
      zIndex: 999,
    }}>
      <span style={{ flex: 1, textAlign: 'center' }}>{text}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          lineHeight: 1,
          color: 'inherit',
          flexShrink: 0,
          padding: '0 4px',
        }}
      >✕</button>
    </div>
  );
}
