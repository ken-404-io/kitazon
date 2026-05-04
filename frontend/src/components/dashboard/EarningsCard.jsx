import styles from './EarningsCard.module.css';

export default function EarningsCard({ label, amount, sub }) {
  return (
    <div className={`card ${styles.card}`}>
      <p className={styles.label}>{label}</p>
      <p className={styles.amount}>₱{parseFloat(amount || 0).toFixed(2)}</p>
      {sub && <p className={styles.sub}>{sub}</p>}
    </div>
  );
}
