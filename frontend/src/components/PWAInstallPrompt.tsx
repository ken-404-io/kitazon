import { useState, useEffect } from 'react';
import styles from './PWAInstallPrompt.module.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_install_dismissed_until';
const DISMISS_DAYS = 7;

function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  // Check navigator.standalone (iOS) or screen width
  const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (standalone) return false; // already installed
  return window.innerWidth < 768;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check dismissal
    const until = localStorage.getItem(DISMISS_KEY);
    if (until && Date.now() < Number(until)) return;

    // Only show on mobile
    if (!isMobile()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.banner}>
      <span className={styles.text}>
        <span className={styles.icon}>📱</span>
        <span>Install Kitazon App — Add to Home Screen</span>
      </span>
      <div className={styles.actions}>
        <button className={styles.installBtn} onClick={handleInstall}>Install</button>
        <button className={styles.dismissBtn} onClick={handleDismiss} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
