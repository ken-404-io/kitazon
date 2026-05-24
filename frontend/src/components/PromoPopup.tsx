import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import styles from './PromoPopup.module.css';

const SHOW_DELAY = 900;
const HIDE_DURATION = 350;

// Routes where the upsell popup should never interrupt the user.
const HIDDEN_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/admin', '/auth', '/verify-email', '/plans'];

export default function PromoPopup() {
  const { getSetting, loadingSettings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const enabled  = getSetting('promo_popup_enabled', 'true') === 'true';
  const image    = getSetting('promo_popup_image', '');
  const redirect = getSetting('promo_popup_redirect', '/plans') || '/plans';

  const onHiddenRoute = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  // Show once per full page load: resets on reload, so the popup reappears every reload.
  const shownThisLoad = useRef(false);

  const eligible = !loadingSettings && enabled && !onHiddenRoute;

  useEffect(() => {
    if (!eligible || shownThisLoad.current) return;

    const showTimer = setTimeout(() => {
      shownThisLoad.current = true;
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    }, SHOW_DELAY);

    return () => clearTimeout(showTimer);
  }, [eligible]);

  // Lock background scroll while the popup is on screen.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setMounted(false), HIDE_DURATION);
  };

  const goToRedirect = () => {
    setVisible(false);
    setTimeout(() => setMounted(false), HIDE_DURATION);
    navigate(redirect);
  };

  // Close on Escape.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted]);

  if (!mounted) return null;

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) dismiss();
  };

  const closeIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  // ── Custom image announcement mode ──
  if (image) {
    return (
      <div className={`${styles.overlay} ${visible ? styles.visible : ''}`} onClick={onOverlayClick} role="dialog" aria-modal="true">
        <div className={styles.imageModal} onClick={goToRedirect} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') goToRedirect(); }} aria-label="Open announcement">
          <button className={`${styles.close} ${styles.imageClose}`} onClick={(e) => { e.stopPropagation(); dismiss(); }} aria-label="Close">
            {closeIcon}
          </button>
          <img src={image} alt="Announcement" />
          <div className={styles.imageMaybe}>
            <button className={styles.maybe} onClick={(e) => { e.stopPropagation(); dismiss(); }}>Maybe Later</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Default designed premium upsell ──
  return (
    <div className={`${styles.overlay} ${visible ? styles.visible : ''}`} onClick={onOverlayClick} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <span className={styles.glow + ' ' + styles.glowTop} />
        <span className={styles.glow + ' ' + styles.glowBottom} />
        <span className={styles.particle} style={{ top: 40, left: 28, width: 6, height: 6 }} />
        <span className={styles.particle} style={{ top: 120, right: 40, width: 4, height: 4, animationDelay: '1.2s' }} />
        <span className={styles.particle} style={{ bottom: 120, left: 50, width: 5, height: 5, animationDelay: '2s' }} />
        <span className={styles.particle} style={{ bottom: 80, right: 70, width: 7, height: 7, animationDelay: '0.6s' }} />

        <button className={styles.close} onClick={dismiss} aria-label="Close">{closeIcon}</button>

        <div className={styles.priceBadge}>
          <small>Starting at</small>
          <b>&#8369;99</b>
        </div>

        <div className={styles.content}>
          <div className={styles.logo}>KITAZON<sup>&#174;</sup></div>

          <span className={styles.badge}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 3h14v2H5v-2z" /></svg>
            Ad-Free Experience
          </span>

          <div className={styles.crownWrap}>
            <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" fill="rgba(255,243,218,0.18)" />
              <circle cx="12" cy="4" r="1" fill="currentColor" />
              <circle cx="3" cy="7" r="1" fill="currentColor" />
              <circle cx="21" cy="7" r="1" fill="currentColor" />
            </svg>
          </div>

          <h2 className={styles.headline}>Too many ads?</h2>

          <p className={styles.sub}>
            Avail any premium plan and enjoy a cleaner, faster, and uninterrupted <b>KITAZON</b> experience.
          </p>

          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><line x1="5.6" y1="5.6" x2="18.4" y2="18.4" /></svg>
              </span>
              <span className={styles.featureLabel}>No ads</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>
              </span>
              <span className={styles.featureLabel}>Faster browsing</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
              </span>
              <span className={styles.featureLabel}>Cleaner dashboard</span>
            </div>
          </div>

          <button className={styles.cta} onClick={goToRedirect}>
            Avail Plans Now
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </button>

          <button className={styles.maybe} onClick={dismiss}>Maybe Later</button>
        </div>
      </div>
    </div>
  );
}
