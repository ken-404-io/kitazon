import { useEffect, useState, useCallback, useRef } from 'react';
import styles from './AdBlockDetector.module.css';

// ── Probe URLs (Adsterra scripts already in use) ────────────────────────────
const PROBE_URLS = [
  'https://pl29417357.profitablecpmratenetwork.com/f8/8b/4a/f88b4accd723fbbe625cbc01ce5fcea6.js',
  'https://pl29417356.profitablecpmratenetwork.com/6eabcdaeb07c57f4f19da67d49052315/invoke.js',
];

// ── DOM bait: class names targeted by popular filter lists ──────────────────
const BAIT_CLASSES = 'adsbox adsbygoogle ad-banner ad-placement ad-slot carbon-ads pub_300x250';

async function checkDomBait(): Promise<boolean> {
  return new Promise((resolve) => {
    const bait = document.createElement('div');
    bait.className = BAIT_CLASSES;
    bait.style.cssText =
      'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(bait);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const s = window.getComputedStyle(bait);
          const rect = bait.getBoundingClientRect();
          const blocked =
            !document.body.contains(bait) ||
            rect.width === 0 ||
            rect.height === 0 ||
            s.display === 'none' ||
            s.visibility === 'hidden' ||
            s.opacity === '0';
          bait.remove();
          resolve(blocked);
        }, 80);
      });
    });
  });
}

async function probeUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    await fetch(`${url}?_=${Math.random()}`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true; // opaque response = reachable
  } catch {
    return false; // TypeError / abort = blocked
  } finally {
    clearTimeout(timer);
  }
}

async function runDetection(): Promise<boolean> {
  const [domBlocked, ...probeReachable] = await Promise.all([
    checkDomBait(),
    ...PROBE_URLS.map(probeUrl),
  ]);
  const allProbesFailed = probeReachable.every((r) => !r);
  const anyProbeFailed  = probeReachable.some((r)  => !r);
  return allProbesFailed || (domBlocked && anyProbeFailed);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AdBlockDetector() {
  const [blocked, setBlocked]     = useState(false);
  const [checking, setChecking]   = useState(false);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef                = useRef(true);

  const check = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    const result = await runDetection();
    if (mountedRef.current) {
      setBlocked(result);
      setChecking(false);
    }
  }, [checking]);

  // Initial detection
  useEffect(() => {
    mountedRef.current = true;
    check();
    return () => { mountedRef.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-recheck every 4 s while modal is visible
  useEffect(() => {
    if (blocked) {
      intervalRef.current = setInterval(check, 4000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [blocked, check]);

  // Recheck on tab/window focus, online, and bfcache restore
  useEffect(() => {
    const recheck = () => { if (mountedRef.current) check(); };
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) recheck(); };

    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    window.addEventListener('online', recheck);
    window.addEventListener('pageshow', onPageShow as EventListener);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
      window.removeEventListener('online', recheck);
      window.removeEventListener('pageshow', onPageShow as EventListener);
    };
  }, [check]);

  if (!blocked) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="ab-title">
      <div className={styles.modal}>

        <div className={styles.iconWrap}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
        </div>

        <h2 id="ab-title" className={styles.title}>Ad Blocker Detected</h2>
        <p className={styles.subtitle}>
          Kitazon is completely free to use — ads are how we pay you. Please disable your ad blocker to continue.
        </p>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>Common blockers to disable:</p>
          <ul className={styles.list}>
            <li>
              <strong>Browser extensions</strong>
              <span>uBlock Origin, AdBlock Plus, AdBlock, Ghostery, Privacy Badger</span>
            </li>
            <li>
              <strong>DNS-level blockers</strong>
              <span>Pi-hole, AdGuard DNS, NextDNS, Cloudflare 1.1.1.1 (filtering mode)</span>
            </li>
            <li>
              <strong>Device / OS settings</strong>
              <span>Android Private DNS, iCloud Private Relay (iOS/macOS), DNS-over-HTTPS in Firefox/Chrome</span>
            </li>
            <li>
              <strong>VPNs with ad filtering</strong>
              <span>NordVPN Threat Protection, ExpressVPN, Mullvad, ProtonVPN (NetShield)</span>
            </li>
          </ul>
        </div>

        <div className={styles.steps}>
          <p className={styles.sectionTitle}>How to allow ads on Kitazon:</p>
          <ol className={styles.stepList}>
            <li>Open your blocker&apos;s settings or extension popup</li>
            <li>Add <code>kitazon.com</code> to the allowlist / whitelist</li>
            <li>Reload this page or tap the button below</li>
          </ol>
        </div>

        <button className={styles.recheckBtn} onClick={check} disabled={checking}>
          {checking ? (
            <>
              <span className={styles.spinner} />
              Checking…
            </>
          ) : (
            "I've disabled it — Recheck"
          )}
        </button>

        <p className={styles.autoNote}>
          The page will unlock automatically once your blocker is disabled.
        </p>
      </div>
    </div>
  );
}
