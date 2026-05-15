import { useParams, Link } from 'react-router-dom';
import styles from './ReferralLanding.module.css';

const BENEFITS = [
  { emoji: '💰', text: 'Earn ₱15–₱500 per task' },
  { emoji: '🎁', text: '₱50 signup bonus just for joining' },
  { emoji: '💳', text: 'Withdraw instantly via GCash' },
];

export default function ReferralLanding() {
  const { code } = useParams<{ code: string }>();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.badge}>Exclusive Invite</div>
        <h1 className={styles.headline}>You've been invited to Kitazon!</h1>
        <p className={styles.sub}>Your friend is sharing a <strong className={styles.highlight}>₱50 signup bonus</strong> with you.</p>

        <ul className={styles.benefits}>
          {BENEFITS.map((b) => (
            <li key={b.text} className={styles.benefit}>
              <span className={styles.benefitEmoji}>{b.emoji}</span>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>

        <Link to={`/register?ref=${code ?? ''}`} className={styles.ctaBtn}>
          Join Free &amp; Claim ₱50 →
        </Link>

        <p className={styles.footnote}>
          Already have an account?{' '}
          <Link to="/login" className={styles.loginLink}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
