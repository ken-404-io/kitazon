import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SpinWheel from '../components/dashboard/SpinWheel';
import EarningsChart from '../components/dashboard/EarningsChart';
import { SkeletonRow } from '../components/ui/Skeleton';
import api from '../services/api';
import { UserStats, Earning } from '../types';
import styles from './Dashboard.module.css';

/* ─── Nav shortcut icons (inline SVG for custom colors) ─────────────────── */
const sz18 = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const NAV_ITEMS = [
  { label: 'Tasks',    to: '/tasks',    color: '#f97316', icon: <svg {...sz18}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { label: 'Withdraw', to: '/withdraw', color: '#22c55e', icon: <svg {...sz18}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
  { label: 'Invite',   to: '/referral', color: '#3b82f6', icon: <svg {...sz18}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { label: 'Spin',     to: '/tasks',    color: '#a855f7', icon: <svg {...sz18}><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg> },
  { label: 'Check-in', to: '/tasks',    color: '#f59e0b', icon: <svg {...sz18}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { label: 'Credits',  to: '/credits',  color: '#60a5fa', icon: <svg {...sz18}><circle cx="12" cy="12" r="10"/><path d="M15 9.5a3.5 3.5 0 1 0-3 5.5"/></svg> },
  { label: 'Plans',    to: '/plans',    color: '#d97706', icon: <svg {...sz18}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  { label: 'History',  to: '/withdraw', color: '#ec4899', icon: <svg {...sz18}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
];

function earningIcon(type: string) {
  if (type === 'spin') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="3"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  );
  if (type === 'referral' || type === 'referral_commission') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    </svg>
  );
  if (type === 'checkin') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 15 11 17 15 13"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function Dashboard() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const navigate      = useNavigate();
  const [stats,          setStats]          = useState<UserStats | null>(null);
  const [recentEarnings, setRecentEarnings] = useState<Earning[]>([]);
  const [loadingStats,   setLoadingStats]   = useState(true);
  const [loadingEarnings,setLoadingEarnings]= useState(true);

  const loadStats = (): void => {
    api.get<UserStats>('/auth/me/stats').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoadingStats(false));
  };

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    setLoadingEarnings(true);
    api.get<{ earnings: Earning[] }>('/tasks/earnings/recent?page=1')
      .then(r => setRecentEarnings(r.data.earnings))
      .catch(() => {})
      .finally(() => setLoadingEarnings(false));
  }, []);

  const balance  = Number(stats?.balance ?? 0);
  const today    = Number(stats?.today   ?? 0);
  const week     = Number(stats?.week    ?? 0);
  const total    = Number(stats?.total   ?? 0);

  return (
    <div className="page-container">
      <div className={styles.page}>

        {/* ── Greeting ── */}
        <div className={styles.greeting}>
          <div>
            <p className={styles.greetSub}>Welcome back</p>
            <h1 className={styles.greetName}>{user?.name?.split(' ')[0] ?? 'User'}</h1>
          </div>
          <Link to="/account" className={styles.avatarBtn}>
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </Link>
        </div>

        {/* ── Navigation grid ── */}
        <p className={styles.sectionLabel}>Navigation</p>
        <div className={styles.navGrid}>
          {NAV_ITEMS.map(item => (
            <Link key={item.label} to={item.to} className={styles.navItem}>
              <div className={styles.navIconWrap} style={{ color: item.color }}>
                {item.icon}
              </div>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* ── Overview section ── */}
        <div className={styles.overviewHeader}>
          <div>
            <p className={styles.sectionLabel} style={{ marginBottom: 2 }}>Earnings Overview</p>
            <p className={styles.overviewSub}>Your complete earnings at a glance</p>
          </div>
        </div>

        {/* ── Big balance card ── */}
        <div className={styles.balanceCard}>
          <div className={styles.balanceCardTop}>
            <div>
              <p className={styles.balanceCardLabel}>Total Balance</p>
              {loadingStats
                ? <div className={styles.balanceSkeleton} />
                : <p className={styles.balanceCardAmt}>₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              }
            </div>
            <button
              className={styles.withdrawQuickBtn}
              onClick={() => navigate('/withdraw')}
            >
              Withdraw →
            </button>
          </div>

          <div className={styles.balanceStats}>
            <div className={styles.balanceStat}>
              <p className={styles.balanceStatLabel}>Today</p>
              <p className={styles.balanceStatVal}>+₱{today.toFixed(2)}</p>
            </div>
            <div className={styles.balanceStatDivider} />
            <div className={styles.balanceStat}>
              <p className={styles.balanceStatLabel}>This Week</p>
              <p className={styles.balanceStatVal}>+₱{week.toFixed(2)}</p>
            </div>
            <div className={styles.balanceStatDivider} />
            <div className={styles.balanceStat}>
              <p className={styles.balanceStatLabel}>All Time</p>
              <p className={styles.balanceStatVal}>₱{total.toFixed(2)}</p>
            </div>
          </div>

          <div className={styles.chartWrap}>
            <EarningsChart />
          </div>
        </div>

        {/* ── Sub cards row ── */}
        <div className={styles.subCards}>
          {/* Recent Earnings */}
          <div className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <span className={styles.subCardTitle}>Recent Earnings</span>
              <Link to="/tasks" className={styles.subCardLink}>See all →</Link>
            </div>
            {loadingEarnings
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              : recentEarnings.length === 0
                ? <p className={styles.emptyMsg}>No earnings yet. <Link to="/tasks">Start a task!</Link></p>
                : recentEarnings.slice(0, 3).map(e => (
                  <div key={e.id} className={styles.earningRow}>
                    <div className={styles.earningIconWrap}>{earningIcon(e.type)}</div>
                    <div className={styles.earningMeta}>
                      <p className={styles.earningTitle}>{e.task_title}</p>
                      <p className={styles.earningTime}>{new Date(e.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className={styles.earningAmt}>+₱{Number(e.amount).toFixed(2)}</span>
                  </div>
                ))
            }
          </div>

          {/* Daily Spin */}
          <div className={styles.subCard} style={{ overflow: 'hidden' }}>
            <p className={styles.subCardTitle} style={{ marginBottom: '0.75rem' }}>Daily Spin</p>
            <SpinWheel onWin={() => { loadStats(); showToast('Spin reward added to your balance!', 'success'); }} />
          </div>
        </div>

      </div>
    </div>
  );
}
