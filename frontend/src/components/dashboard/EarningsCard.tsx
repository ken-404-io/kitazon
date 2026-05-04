import styles from './EarningsCard.module.css';

interface Props {
  label: string;
  amount?: number | string;
  sub?: string;
}

export default function EarningsCard({ label, amount, sub }: Props) {
  return (
    <div className={`card ${styles.card}`}>
      <p className={styles.label}>{label}</p>
      <p className={styles.amount}>₱{parseFloat(String(amount ?? 0)).toFixed(2)}</p>
      {sub && <p className={styles.sub}>{sub}</p>}
    </div>
  );
}
