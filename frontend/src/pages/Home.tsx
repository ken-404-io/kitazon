import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PayoutFeed from '../components/payout/PayoutFeed';
import { SurveyIcon, PhoneIcon, PlayIcon, BriefcaseIcon, GamepadIcon, UsersIcon, ZapIcon, ClockIcon, ShieldIcon, MapPinIcon } from '../components/ui/Icons';
import styles from './Home.module.css';

const GOOGLE_REDIRECT = `${process.env.REACT_APP_API_URL ?? 'https://api.kitazon.com'}/api/auth/google/redirect`;

const TICKER_ITEMS = [
  { name: 'Maria S.', amount: 150 },
  { name: 'Juan D.', amount: 75 },
  { name: 'Ana R.', amount: 320 },
  { name: 'Carlo M.', amount: 50 },
  { name: 'Liza T.', amount: 200 },
  { name: 'Renz B.', amount: 90 },
  { name: 'Jessa P.', amount: 500 },
  { name: 'Mark C.', amount: 60 },
  { name: 'Nina V.', amount: 110 },
  { name: 'Felix A.', amount: 430 },
];

const EARNING_CATEGORIES = [
  { icon: <SurveyIcon />,    name: 'Surveys & Polls',   range: '₱20 – ₱150',       desc: 'Answer surveys from global market research firms.' },
  { icon: <PhoneIcon />,     name: 'App Installs',      range: '₱30 – ₱500',       desc: 'Install and try apps, earn per qualified install.' },
  { icon: <PlayIcon />,      name: 'Video Watch',       range: '₱5 – ₱25',         desc: 'Watch short sponsored ads and engagement tasks.' },
  { icon: <BriefcaseIcon />, name: 'Micro-Jobs',        range: '₱10 – ₱200',       desc: 'Data entry, image labeling, Tagalog transcription.' },
  { icon: <GamepadIcon />,   name: 'Game Earnings',     range: '₱20 – ₱1,000',     desc: 'Play casual games and join daily tournaments.' },
  { icon: <UsersIcon />,     name: 'Referral Program',  range: '20% Lifetime',      desc: "₱50 signup bonus + 20% of your referrals' earnings forever." },
];

const WHY_ITEMS = [
  { icon: <ZapIcon />,     label: '₱5 Min Withdraw', desc: 'Lowest threshold so you can verify we pay, fast.' },
  { icon: <ClockIcon />,   label: '1-Hour Cashout',   desc: 'GCash & Maya payouts processed within 1 hour.' },
  { icon: <ShieldIcon />,  label: 'Secure & Legit',   desc: 'SEC-registered corporation. BSP-compliant operations.' },
  { icon: <MapPinIcon />,  label: 'Built for Filipinos', desc: 'Tagalog UI, local payment rails, local support.' },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <main>
      <section className={styles.hero}>
        <h1>Earn Real Money Online</h1>
        <p className={styles.tagline}>Complete simple tasks and get paid — directly to your PayPal account.</p>
        <div className={styles.heroBadges}>
          <span className="badge badge-gold">Min ₱5 Withdrawal</span>
          <span className="badge badge-green">Cashout via PayPal</span>
          <span className="badge badge-gold">₱15 – ₱500 per Task</span>
        </div>

        {!user && (
          <div className={styles.ticker} aria-hidden="true">
            <div className={styles.tickerTrack}>
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                <span key={i} className={styles.tickerItem}>
                  🎉 <strong>{item.name}</strong> earned ₱{item.amount}
                </span>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div className={styles.heroGoogle}>
            <a href={GOOGLE_REDIRECT} className={styles.heroGoogleBtn}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </a>
            <p className={styles.orDivider}>— or —</p>
          </div>
        )}

        <div className={styles.heroCta}>
          {user ? (
            <Link to="/dashboard">
              <button className="btn-primary" style={{ fontSize: '1.05rem', padding: '0.8rem 2rem' }}>
                Go to Dashboard →
              </button>
            </Link>
          ) : (
            <Link to="/register">
              <button className="btn-primary" style={{ fontSize: '1.05rem', padding: '0.8rem 2rem' }}>
                Join Free — Start Earning
              </button>
            </Link>
          )}
          <Link to="/payout-proof" className={styles.proofLink}>See Real Payout Proof →</Link>
        </div>
      </section>

      <section className="page-container">
        <h2 className={styles.sectionTitle}>6 Ways to Earn on Kitazon</h2>
        <div className="grid-3">
          {EARNING_CATEGORIES.map((c) => (
            <div key={c.name} className={`card ${styles.catCard}`}>
              <span className={styles.catIcon}>{c.icon}</span>
              <h3>{c.name}</h3>
              <p className={styles.range}>{c.range}</p>
              <p className={styles.catDesc}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.whySection}>
        <div className="page-container">
          <h2 className={styles.sectionTitle}>Why Kitazon?</h2>
          <div className="grid-4">
            {WHY_ITEMS.map((w) => (
              <div key={w.label} className={`card ${styles.whyCard}`}>
                <span className={styles.whyIcon}>{w.icon}</span>
                <strong>{w.label}</strong>
                <p>{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-container">
        <h2 className={styles.sectionTitle}>Recent Payouts</h2>
        <PayoutFeed />
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/payout-proof">View all payout proofs →</Link>
        </div>
      </section>
    </main>
  );
}
