import { Link } from 'react-router-dom';
import PayoutFeed from '../components/payout/PayoutFeed';
import styles from './Home.module.css';

const EARNING_CATEGORIES = [
  { icon: '📋', name: 'Surveys & Polls', range: '₱20 – ₱150', desc: 'Answer surveys from global market research firms.' },
  { icon: '📱', name: 'App Installs', range: '₱30 – ₱500', desc: 'Install and try apps, earn per qualified install.' },
  { icon: '🎬', name: 'Video Watch', range: '₱5 – ₱25', desc: 'Watch short sponsored ads and engagement tasks.' },
  { icon: '💼', name: 'Micro-Jobs', range: '₱10 – ₱200', desc: 'Data entry, image labeling, Tagalog transcription.' },
  { icon: '🎮', name: 'Game Earnings', range: '₱20 – ₱1,000', desc: 'Play casual games and join daily tournaments.' },
  { icon: '🤝', name: 'Referral Program', range: '20% Lifetime', desc: '₱50 signup bonus + 20% of your referrals\' earnings forever.' },
];

export default function Home() {
  return (
    <main>
      <section className={styles.hero}>
        <h1>💰 Earn Real Money Online</h1>
        <p className={styles.tagline}>Complete simple tasks and get paid — directly to GCash, Maya, and major PH banks.</p>
        <div className={styles.heroBadges}>
          <span className="badge badge-gold">Min ₱50 Withdrawal</span>
          <span className="badge badge-green">Cashout in 1 Hour</span>
          <span className="badge badge-gold">₱15 – ₱500 per Task</span>
        </div>
        <div className={styles.heroCta}>
          <Link to="/register"><button className="btn-primary" style={{ fontSize: '1.05rem', padding: '0.8rem 2rem' }}>Join Free — Start Earning</button></Link>
          <Link to="/payout-proof" className={styles.proofLink}>See Real Payout Proof →</Link>
        </div>
      </section>

      <section className="page-container">
        <h2 className={styles.sectionTitle}>6 Ways to Earn on Kitazon</h2>
        <div className="grid-3">
          {EARNING_CATEGORIES.map(c => (
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
            {[
              { icon: '🚀', label: '₱50 Min Withdraw', desc: 'Lowest threshold so you can verify we pay, fast.' },
              { icon: '⚡', label: '1-Hour Cashout', desc: 'GCash & Maya payouts processed within 1 hour.' },
              { icon: '🔒', label: 'Secure & Legit', desc: 'SEC-registered corporation. BSP-compliant operations.' },
              { icon: '🇵🇭', label: 'Built for Filipinos', desc: 'Tagalog UI, local payment rails, local support.' },
            ].map(w => (
              <div key={w.label} className={`card ${styles.whyCard}`}>
                <span style={{ fontSize: '2rem' }}>{w.icon}</span>
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
