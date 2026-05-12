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

export function SkeletonTaskRow() {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1rem', marginBottom: '0.6rem' }}>
      <Skeleton height={40} width={40} borderRadius={10} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton height={15} width="55%" />
        <Skeleton height={11} width="35%" />
      </div>
      <Skeleton height={32} width={72} borderRadius={10} style={{ flexShrink: 0 }} />
    </div>
  );
}

export function SkeletonBalanceCard() {
  return (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Skeleton height={14} width="35%" />
      <Skeleton height={42} width="55%" />
      <div style={{ display: 'flex', gap: 12 }}>
        <Skeleton height={12} width="28%" />
        <Skeleton height={12} width="28%" />
        <Skeleton height={12} width="28%" />
      </div>
    </div>
  );
}

export function SkeletonStatBar() {
  return (
    <div className="card" style={{ display: 'flex', gap: '1rem', padding: '1rem', justifyContent: 'space-between' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <Skeleton height={28} width="60%" />
          <Skeleton height={11} width="70%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '1.25rem' }}>
      <Skeleton height={13} width="30%" />
      <Skeleton height={42} />
      <Skeleton height={13} width="30%" />
      <Skeleton height={42} />
      <Skeleton height={42} borderRadius={12} />
    </div>
  );
}

export function SkeletonReferralEntry() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0', borderBottom: '1px solid var(--dark-border)' }}>
      <Skeleton height={38} width={38} borderRadius="50%" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton height={14} width="40%" />
        <Skeleton height={11} width="25%" />
      </div>
      <Skeleton height={20} width={60} borderRadius={20} style={{ flexShrink: 0 }} />
    </div>
  );
}

export function SkeletonPlanCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '1.5rem', minWidth: 200 }}>
      <Skeleton height={20} width="50%" />
      <Skeleton height={36} width="65%" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1,2,3,4].map(i => <Skeleton key={i} height={13} width={`${60 + i * 5}%`} />)}
      </div>
      <Skeleton height={42} borderRadius={12} />
    </div>
  );
}

export function SkeletonWithdrawForm() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SkeletonStatBar />
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '1.25rem' }}>
        <Skeleton height={13} width="25%" />
        <Skeleton height={42} />
        <Skeleton height={13} width="30%" />
        <Skeleton height={42} />
        <Skeleton height={13} width="25%" />
        <Skeleton height={42} />
        <Skeleton height={44} borderRadius={12} />
      </div>
    </div>
  );
}
