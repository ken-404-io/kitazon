import { Link } from 'react-router-dom';
import styles from './PaymentSuccess.module.css';

export default function PaymentCancel() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconErr}>✕</div>
        <h2>Payment Cancelled</h2>
        <p className={styles.sub}>No charge was made. You can try again whenever you're ready.</p>
        <Link to="/plans" className={styles.btn}>Back to Plans</Link>
      </div>
    </div>
  );
}
