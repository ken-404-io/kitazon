import styles from './Skeleton.module.css';

interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  borderRadius?: number | string;
  style?: React.CSSProperties;
}

export function Skeleton({ height = 20, width = '100%', borderRadius = 6, style }: SkeletonProps) {
  return (
    <div
      className={styles.skeleton}
      style={{ height, width, borderRadius, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton height={18} width="60%" />
      <Skeleton height={14} width="40%" />
      <Skeleton height={32} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton height={16} width="50%" />
        <Skeleton height={12} width="30%" />
      </div>
      <Skeleton height={28} width={70} borderRadius={20} />
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <Skeleton height={36} width={100} />
      <Skeleton height={14} width={80} />
    </div>
  );
}
