import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EarningsCard from '../components/dashboard/EarningsCard';
import SpinWheel from '../components/dashboard/SpinWheel';
import EarningsChart from '../components/dashboard/EarningsChart';
import { SkeletonStat, SkeletonRow } from '../components/ui/Skeleton';
import api from '../services/api';
import { UserStats, Earning } from '../types';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentEarnings, setRecentEarnings] = useState<Earning[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [earningsPage, setEarningsPage] = useState(1);
  const [earningsPages, setEarningsPages] = useState(1);

  const loadStats = (): void => {
    api.get<UserStats>('/auth/me/stats').then((res) => setStats(res.data)).catch(() => {}).finally(() => setLoadingStats(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    setLoadingEarnings(true);
    api.get<{ earnings: Earning[]; pages: number }>(`/tasks/earnings/recent?page=${earningsPage}`)
      .then((res) => { setRecentEarnings(res.data.earnings); setEarningsPages(res.data.pages); })
      .catch(() => {})
      .finally(() => setLoadingEarnings(false));
  }, [earningsPage]);

  return (
    <div className="page-container">
      <div className={styles.header}>
        <div>
          <h1>Hi, {user?.name?.split(' ')[0]} 👋</h1>
          <p className={styles.sub}>Here's your earnings overview</p>
        </div>
        <Link to="/withdraw">
          <button className="btn-primary">Withdraw ₱{Number(stats?.balance ?? 0).toFixed(2)}</button>
        </Link>
      </div>

      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        {loadingStats ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)
        ) : (
          <>
            <EarningsCard label="Balance" amount={stats?.balance} />
            <EarningsCard label="Today" amount={stats?.today} />
            <EarningsCard label="This Week" amount={stats?.week} />
            <EarningsCard label="All Time" amount={stats?.total} />
          </>
        )}
      </div>

      <div className={styles.mainGrid}>
        <div>
          <div className={styles.sectionHeader}>
            <h3>Recent Earnings</h3>
            <Link to="/tasks">Browse tasks →</Link>
          </div>
          {loadingEarnings ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
          ) : recentEarnings.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No earnings yet. <Link to="/tasks">Complete your first task!</Link>
            </div>
          ) : recentEarnings.map((e) => (
            <div key={e.id} className={`card ${styles.earningRow}`}>
              <div>
                <p className={styles.earningTitle}>{e.task_title}</p>
                <p className={styles.earningTime}>{new Date(e.created_at).toLocaleString('en-PH')}</p>
              </div>
              <span className="badge badge-green">+₱{e.amount}</span>
            </div>
          ))}
          {earningsPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem', alignItems: 'center' }}>
              <button className="btn-outline" style={{ padding: '4px 12px', fontSize: 13 }} disabled={earningsPage <= 1} onClick={() => setEarningsPage((p) => p - 1)}>← Prev</button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{earningsPage} / {earningsPages}</span>
              <button className="btn-outline" style={{ padding: '4px 12px', fontSize: 13 }} disabled={earningsPage >= earningsPages} onClick={() => setEarningsPage((p) => p + 1)}>Next →</button>
            </div>
          )}
          <EarningsChart />
        </div>
        <SpinWheel onWin={() => { loadStats(); showToast('🎉 Spin reward added to your balance!', 'success'); }} />
      </div>
    </div>
  );
}
