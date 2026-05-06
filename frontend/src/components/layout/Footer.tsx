import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p><strong>Kitazon</strong> — Earn More. Withdraw Faster.</p>
      <p className={styles.sub}>Built in the Philippines, for the Philippines. &copy; {new Date().getFullYear()} Kitazon Technologies Corp.</p>
      <div className={styles.links}>
        <a href="mailto:contact@kitazon.ph">contact@kitazon.ph</a>
        <span>&middot;</span>
        <a href="/payout-proof">Payout Proof</a>
        <span>&middot;</span>
        <a href="/leaderboard">Leaderboard</a>
      </div>
    </footer>
  );
}
