import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EarningsCard from '../components/dashboard/EarningsCard';
import SpinWheel from '../components/dashboard/SpinWheel';
import EarningsChart from '../components/dashboard/EarningsChart';
import { SkeletonStat, SkeletonRow } from '../components/ui/Skeleton';
import {
  CreditCardIcon, CalendarIcon, BarChartIcon, TrophyIcon,
  DiceIcon, UsersIcon, SmartphoneIcon,
  CheckCircleIcon, ShieldCheckIcon, TargetIcon, WalletBigIcon,
} from '../components/ui/Icons';
import api from '../services/api';
import { UserStats, Earning } from '../types';
import styles from './Dashboard.module.css';

function earningIcon(type: string) {
  if (type === 'spin')               return <DiceIcon />;
  if (type === 'referral_commission') return <UsersIcon />;
  return <CheckCircleIcon />;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentEarnings, setRecentEarnings] = useState<Earning[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const loadStats = (): void => {
    api.get<UserStats>('/auth/me/stats').then((res) => setStats(res.data)).catch(() => {}).finally(() => setLoadingStats(false));
  };

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    setLoadingEarnings(true);
    api.get<{ earnings: Earning[]; pages: number }>('/tasks/earnings/recent?page=1')
      .then((res) => { setRecentEarnings(res.data.earnings); })
      .catch(() => {})
      .finally(() => setLoadingEarnings(false));
  }, []);

  return (
    <div className="page-container">

      {/* Hero banner */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.heroTitle}>Hi, {user?.name?.split(' ')[0]}</h1>
          <p className={styles.heroSub}>Here's your earnings overview</p>
          <Link to="/withdraw">
            <button className="btn-primary" style={{ marginTop: '1rem', borderRadius: 12 }}>
              Withdraw ₱{Number(stats?.balance ?? 0).toFixed(2)} →
            </button>
          </Link>
        </div>
        <div className={styles.heroIcon}><WalletBigIcon /></div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: '1.25rem' }}>
        {loadingStats ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)
        ) : (
          <>
            <EarningsCard label="Balance"   amount={stats?.balance} color="var(--primary)"       icon={<CreditCardIcon />} iconBg="var(--primary-subtle)" />
            <EarningsCard label="Today"     amount={stats?.today}   color="var(--primary-amber)" icon={<CalendarIcon />}  iconBg="var(--amber-subtle)" />
            <EarningsCard label="This Week" amount={stats?.week}    color="var(--primary)"       icon={<BarChartIcon />}  iconBg="var(--primary-subtle)" />
            <EarningsCard label="All Time"  amount={stats?.total}   color="var(--primary-dark)"  icon={<TrophyIcon />}    iconBg="var(--deep-subtle)" />
          </>
        )}
      </div>

      {/* Recent Earnings + Spin */}
      <div className={styles.mainGrid}>
        <div>
          <div className={styles.sectionHeader}>
            <h3>Recent Earnings</h3>
            <Link to="/tasks" style={{ fontSize: 13, color: 'var(--primary)' }}>Browse tasks →</Link>
          </div>
          {loadingEarnings ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
          ) : recentEarnings.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No earnings yet. <Link to="/tasks">Complete your first task!</Link>
            </div>
          ) : recentEarnings.slice(0, 3).map((e) => (
            <div key={e.id} className={`card ${styles.earningRow}`}>
              <div className={styles.earningIcon} style={{ color: 'var(--primary)' }}>{earningIcon(e.type)}</div>
              <div style={{ flex: 1 }}>
                <p className={styles.earningTitle}>{e.task_title}</p>
                <p className={styles.earningTime}>{new Date(e.created_at).toLocaleString('en-PH')}</p>
              </div>
              <span className="badge badge-green">+₱{e.amount}</span>
            </div>
          ))}
          <EarningsChart />
        </div>
        <SpinWheel onWin={() => { loadStats(); showToast('Spin reward added to your balance!', 'success'); }} />
      </div>

      {/* Footer nudge */}
      <div className="card" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--nudge-bg)', border: '1px solid var(--nudge-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: 'var(--green)' }}><ShieldCheckIcon /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Keep going!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Complete tasks and spin daily to earn more.</div>
          </div>
        </div>
        <div style={{ color: 'var(--primary)' }}><TargetIcon /></div>
      </div>
    </div>
  );
}
