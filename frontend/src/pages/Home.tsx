import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Home.module.css';

const GOOGLE_REDIRECT = `${process.env.REACT_APP_API_URL ?? 'https://api.kitazon.com'}/api/auth/google/redirect`;

const CheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);
const WalletIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/><path d="M15 15h2"/>
  </svg>
);
const ZapIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
  </svg>
);
const GiftIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/>
    <line x1="12" y1="22" x2="12" y2="7"/>
    <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
  </svg>
);

const FEATURES = [
  { icon: <CheckIcon />, label: 'Easy Tasks',    desc: 'Simple and fun ways to earn' },
  { icon: <WalletIcon />, label: 'Real Rewards', desc: 'Get real pesos you can use' },
  { icon: <ZapIcon />,    label: 'Fast Payouts', desc: 'Quick and secure withdrawals' },
  { icon: <ShieldIcon />, label: 'Safe & Secure', desc: 'Your data and earnings are safe' },
];

const PHONE_TASKS = [
  { color: '#e74c3c', label: 'Watch Videos',    reward: '+₱10' },
  { color: '#3498db', label: 'Answer Surveys',  reward: '+₱15' },
  { color: '#9b59b6', label: 'Play Games',      reward: '+₱10' },
  { color: '#2ecc71', label: 'Invite Friends',  reward: '+₱15' },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <main className={styles.root}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={styles.tagBadge}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
            EARN &bull; REDEEM &bull; ENJOY
          </span>

          <h1 className={styles.heroTitle}>
            EARN WITH<br />
            <span className={styles.heroTitleAccent}>KITAZON</span>
          </h1>
          <p className={styles.heroSubtitle}>Complete simple tasks and earn real rewards!</p>

          <div className={styles.heroPayout}>
            <span className={styles.heroPayoutLabel}>EARN UP TO</span>
            <div className={styles.heroPayoutAmount}>
              <span className={styles.heroPeso}>₱</span>
              <span className={styles.heroNumber}>500</span>
            </div>
            <div className={styles.heroPayoutBanner}>PER TASK</div>
          </div>

          {user ? (
            <Link to="/dashboard" className={styles.ctaBtn}>GO TO DASHBOARD</Link>
          ) : (
            <Link to="/register" className={styles.ctaBtn}>START EARNING</Link>
          )}
        </div>

        {/* Phone mockup */}
        <div className={styles.heroRight}>
          <div className={styles.phone}>
            <div className={styles.phoneNotch} />
            <div className={styles.phoneScreen}>
              <div className={styles.phoneBalance}>
                <span className={styles.phoneBalanceLabel}>My Balance</span>
                <span className={styles.phoneBalanceAmount}>₱50.00</span>
                <span className={styles.phoneBalanceSub}>Available Balance</span>
              </div>
              <div className={styles.phoneTasks}>
                {PHONE_TASKS.map((t) => (
                  <div key={t.label} className={styles.phoneTask}>
                    <span className={styles.phoneTaskDot} style={{ background: t.color }} />
                    <span className={styles.phoneTaskLabel}>{t.label}</span>
                    <span className={styles.phoneTaskReward}>{t.reward}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Coin decorations */}
          <div className={styles.coin} style={{ top: '10%', right: '8%' }}>₱</div>
          <div className={styles.coin} style={{ bottom: '20%', right: '2%', width: 40, height: 40, fontSize: '0.9rem' }}>₱</div>
          <div className={styles.coin} style={{ top: '45%', left: '0%', width: 36, height: 36, fontSize: '0.8rem' }}>₱</div>
        </div>
      </section>

      {/* ── Features strip ───────────────────────────────────────────────────── */}
      <section className={styles.features}>
        <div className={styles.featuresCard}>
          {FEATURES.map((f) => (
            <div key={f.label} className={styles.featureItem}>
              <div className={styles.featureIconWrap}>{f.icon}</div>
              <span className={styles.featureLabel}>{f.label}</span>
              <span className={styles.featureDesc}>{f.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Signup bonus card ────────────────────────────────────────────────── */}
      {!user && (
        <section className={styles.bonusSection}>
          <div className={styles.bonusCard}>
            <div className={styles.bonusIcon}><GiftIcon /></div>
            <div className={styles.bonusText}>
              <span className={styles.bonusNew}>NEW HERE?</span>
              <span className={styles.bonusLine}>Sign up now and get a</span>
              <span className={styles.bonusAmount}>₱10 BONUS!</span>
            </div>
          </div>
          <div className={styles.bonusDots}>
            <span className={`${styles.dot} ${styles.dotActive}`} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>

          <div className={styles.signupOptions}>
            <a href={GOOGLE_REDIRECT} className={styles.googleBtn}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </a>
            <Link to="/register" className={styles.registerBtn}>Create Free Account</Link>
          </div>
        </section>
      )}

    </main>
  );
}
