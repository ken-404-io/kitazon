import styles from './EarningsCard.module.css';

interface Props {
  label: string;
  amount?: number | string;
  sub?: string;
  color?: string;
  icon?: string;
  iconBg?: string;
}

export default function EarningsCard({ label, amount, sub, color = 'var(--primary)', icon = '💰', iconBg = 'rgba(249,115,22,0.12)' }: Props) {
  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.iconWrap} style={{ background: iconBg }}>{icon}</div>
      <p className={styles.label}>{label}</p>
      <p className={styles.amount} style={{ color }}>{'₱'}{parseFloat(String(amount ?? 0)).toFixed(2)}</p>
      {sub && <p className={styles.sub}>{sub}</p>}
    </div>
  );
}
