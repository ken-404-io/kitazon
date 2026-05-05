import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EarningsCard from '../components/dashboard/EarningsCard';
import SpinWheel from '../components/dashboard/SpinWheel';
import api from '../services/api';
import { UserStats, Earning } from '../types';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentEarnings, setRecentEarnings] = useState<Earning[]>([]);

  const loadStats = (): void => {
    api.get<UserStats>('/auth/me/stats').then((res) => setStats(res.data)).catch(() => {});
  };

  useEffect(() => {
    loadStats();
    api.get<Earning[]>('/tasks/earnings/recent').then((res) => setRecentEarnings(res.data)).catch(() => {});
  }, []);

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
        <EarningsCard label="Balance" amount={stats?.balance} />
        <EarningsCard label="Today" amount={stats?.today} />
        <EarningsCard label="This Week" amount={stats?.week} />
        <EarningsCard label="All Time" amount={stats?.total} />
      </div>

      <div className={styles.mainGrid}>
        <div>
          <div className={styles.sectionHeader}>
            <h3>Recent Earnings</h3>
            <Link to="/tasks">Browse tasks →</Link>
          </div>
          {recentEarnings.length === 0 ? (
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
        </div>
        <SpinWheel onWin={loadStats} />
      </div>
    </div>
  );
}
