import PayoutFeed from '../components/payout/PayoutFeed';
import styles from './PayoutProof.module.css';

export default function PayoutProof() {
  return (
    <div className="page-container">
      <div className={styles.header}>
        <h1>💸 Payout Proof</h1>
        <p className={styles.sub}>Real withdrawals from real Kitazon users — updated in real time.</p>
      </div>
      <PayoutFeed />
    </div>
  );
}
