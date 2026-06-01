import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { SurveyIcon, PhoneIcon, PlayIcon, BriefcaseIcon, GamepadIcon, UsersIcon, ZapIcon, ClockIcon, ShieldIcon, MapPinIcon } from '../components/ui/Icons';
import styles from './Home.module.css';

// The max-withdrawal feature line is built at render time from the live
// `plan_limit_<plan>` site settings so it always matches the admin panel.
const PRICING_PLANS = [
  {
    name: 'Free',
    plan: 'free',
    price: 'Free',
    color: 'var(--text-muted)',
    limitDefault: 5,
    features: ['GCash withdrawals', 'Task earnings', 'Referral bonuses'],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Silver',
    plan: 'silver',
    price: '₱499/mo',
    color: '#9ca3af',
    limitDefault: 20,
    features: ['Choose withdrawal amount', 'Priority support', 'All Free features'],
    cta: 'Upgrade',
    highlight: false,
  },
  {
    name: 'Gold',
    plan: 'gold',
    price: '₱1,299/mo',
    color: 'var(--primary-amber)',
    limitDefault: 50,
    features: ['Choose withdrawal amount', 'Priority support', 'All Silver features'],
    cta: 'Upgrade',
    highlight: true,
  },
  {
    name: 'Diamond',
    plan: 'diamond',
    price: '₱1,999/mo',
    color: '#60a5fa',
    limitDefault: 100,
    features: ['Choose withdrawal amount', 'VIP support', 'All Gold features'],
    cta: 'Upgrade',
    highlight: false,
  },
];

const GOOGLE_REDIRECT = `${process.env.REACT_APP_API_URL ?? 'https://api.kitazon.com'}/api/auth/google/redirect`;

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

// The mini "Recent Earnings" feed shown inside the hero phone mockup.
const PHONE_FEED = [
  { icon: <SurveyIcon />,    label: 'Surveys & Polls', amount: '+₱50.00' },
  { icon: <PhoneIcon />,     label: 'App Installs',    amount: '+₱30.00' },
  { icon: <BriefcaseIcon />, label: 'Micro-Jobs',      amount: '+₱120.00' },
  { icon: <GamepadIcon />,   label: 'Game Earnings',   amount: '+₱250.00' },
];

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#f97316,#fbbf24)',
  'linear-gradient(135deg,#fb923c,#f59e0b)',
  'linear-gradient(135deg,#ea580c,#f97316)',
  'linear-gradient(135deg,#f59e0b,#fcd34d)',
];

export default function Home() {
  const { user, loading } = useAuth();
  const { getSetting } = useSettings();

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const socialProof = (
    <div className={styles.socialProof}>
      <div className={styles.avatarStack}>
        {AVATAR_GRADIENTS.map((g, i) => (
          <span key={i} className={styles.avatar} style={{ background: g }} />
        ))}
      </div>
      <p><strong>5,000,000+</strong> users earning every day</p>
    </div>
  );

  return (
    <main>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          {/* ── Copy column ─────────────────────────────────────────────── */}
          <div className={styles.heroCopy}>
            <span className={styles.trustPill}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Trusted by thousands of Filipinos
            </span>

            <h1 className={styles.heroTitle}>
              Earn Real Money<br />
              <span className={styles.heroAccent}>Online</span>
            </h1>

            <p className={styles.tagline}>
              Complete simple tasks and get paid — directly to your GCash account.
            </p>

            <div className={styles.heroBadges}>
              <span className="badge badge-gold">Min ₱5 Withdrawal</span>
              <span className="badge badge-green">Cashout via GCash</span>
              <span className="badge badge-gold">₱15 – ₱500 per Task</span>
            </div>

            <div className={styles.heroCta}>
              <Link to="/register" className={styles.ctaPrimary}>
                Join Free — Start Earning
              </Link>
              {!user && (
                <a href={GOOGLE_REDIRECT} className={styles.ctaGoogle}>
                  <GoogleGlyph />
                  Continue with Google
                </a>
              )}
            </div>

            {socialProof}
          </div>

          {/* ── Phone mockup column ─────────────────────────────────────── */}
          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.phone}>
              <div className={styles.phoneBalance}>
                <span className={styles.phoneBalanceLabel}>Your Balance</span>
                <span className={styles.phoneBalanceAmount}>₱ 12,450.00</span>
                <span className={styles.phoneGcash}>GCash</span>
              </div>
              <div className={styles.phoneFeed}>
                <span className={styles.phoneFeedTitle}>Recent Earnings</span>
                {PHONE_FEED.map((f) => (
                  <div key={f.label} className={styles.phoneRow}>
                    <span className={styles.phoneRowIcon}>{f.icon}</span>
                    <span className={styles.phoneRowLabel}>{f.label}</span>
                    <span className={styles.phoneRowAmount}>{f.amount}</span>
                  </div>
                ))}
                <span className={styles.phoneViewAll}>View All</span>
              </div>
            </div>
          </div>
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
        <h2 className={styles.sectionTitle}>Plans &amp; Pricing</h2>
        <p className={styles.pricingSubtitle}>Upgrade your plan to unlock higher daily withdrawal limits.</p>
        <div className={styles.pricingGrid}>
          {PRICING_PLANS.map((p) => (
            <div key={p.name} className={`${styles.pricingCard} ${p.highlight ? styles.pricingCardHighlight : ''}`}>
              {p.highlight && <span className={styles.popularBadge}>Most Popular</span>}
              <p className={styles.pricingName} style={{ color: p.color }}>{p.name}</p>
              <p className={styles.pricingPrice}>{p.price}</p>
              <ul className={styles.pricingFeatures}>
                {[
                  `₱${getSetting(`plan_limit_${p.plan}`, String(p.limitDefault))} max withdrawal per request`,
                  ...p.features,
                ].map(f => (
                  <li key={f}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.checkIcon}><polyline points="20 6 9 17 4 12"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className={styles.pricingCta}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
