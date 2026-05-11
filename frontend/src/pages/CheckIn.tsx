import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import styles from './CheckIn.module.css';

interface Task { id: number; title: string; description: string; category: string; payout: number; is_completed: boolean; }
interface Stats { balance: number; }

export default function CheckIn() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const navigate      = useNavigate();

  const [balance,   setBalance]   = useState<number | null>(null);
  const [streak,    setStreak]    = useState<number>(0);
  const [done,      setDone]      = useState(false);
  const [claiming,  setClaiming]  = useState(false);
  const [tasks,     setTasks]     = useState<Task[]>([]);

  useEffect(() => {
    api.get<Stats>('/auth/me/stats').then(r => setBalance(Number(r.data.balance))).catch(() => {});
    api.get<Task[]>('/tasks').then(r => setTasks(r.data.filter(t => !t.is_completed).slice(0, 6))).catch(() => {});
  }, []);

  const handleCheckin = async () => {
    if (done || claiming) return;
    setClaiming(true);
    try {
      const res = await api.post<{ amount: number; streak: number; message: string }>('/tasks/checkin');
      setStreak(res.data.streak);
      setDone(true);
      setBalance(b => (b ?? 0) + res.data.amount);
      showToast(`+₱${res.data.amount} earned! 🔥 Day ${res.data.streak} streak`, 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string; streak?: number } } }).response?.data?.message ?? '';
      const s   = (err as { response?: { data?: { streak?: number } } }).response?.data?.streak;
      if (s !== undefined) setStreak(s);
      if (msg.toLowerCase().includes('already')) { setDone(true); showToast('Already checked in today!', 'success'); }
      else showToast(msg || 'Check-in failed.', 'error');
    } finally { setClaiming(false); }
  };

  const handleComplete = async (task: Task) => {
    try {
      const res = await api.post<{ amount: number }>(`/tasks/${task.id}/complete`);
      setTasks(ts => ts.filter(t => t.id !== task.id));
      setBalance(b => (b ?? 0) + res.data.amount);
      showToast(`+₱${res.data.amount} earned from "${task.title}"!`, 'success');
    } catch (err: unknown) {
      showToast((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.', 'error');
    }
  };

  const firstName = user?.name?.split(' ')[0] ?? 'User';
  const initial   = firstName[0]?.toUpperCase() ?? 'U';

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.userRow}>
          <div className={styles.avatar}>{initial}</div>
          <div>
            <p className={styles.hi}>Hi {firstName}!</p>
            <p className={styles.welcome}>Welcome Back 👋</p>
          </div>
        </div>
        <button className={styles.notifBtn} onClick={() => navigate('/account')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
      </div>

      {/* ── Balance card ── */}
      <div className={styles.balanceCard}>
        <p className={styles.balanceLabel}>Current Balance</p>
        <div className={styles.balanceRow}>
          <span className={styles.coinIcon}>🪙</span>
          <span className={styles.balanceAmt}>
            {balance === null ? '—' : balance.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
        </div>
        <Link to="/withdraw" className={styles.walletBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          My Wallet
        </Link>
      </div>

      {/* ── 3 quick actions ── */}
      <div className={styles.quickActions}>

        {/* Daily Check-in */}
        <button className={styles.actionBtn} onClick={handleCheckin} disabled={done || claiming}>
          <div className={`${styles.actionCircle} ${done ? styles.actionDone : styles.actionCheckin}`}>
            {done
              ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : claiming
                ? <span className={styles.spinner} />
                : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            }
          </div>
          <span className={styles.actionLabel}>
            {done ? 'Checked In ✓' : 'Daily Check In'}
          </span>
          {streak > 0 && <span className={styles.actionSub}>🔥 Day {streak}</span>}
        </button>

        {/* Spin & Win */}
        <Link to="/dashboard" className={styles.actionBtn} onClick={e => { e.preventDefault(); navigate('/dashboard'); setTimeout(() => document.getElementById('spin-section')?.scrollIntoView({ behavior: 'smooth' }), 300); }}>
          <div className={`${styles.actionCircle} ${styles.actionSpin}`}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </div>
          <span className={styles.actionLabel}>Spin &amp; Win</span>
          <span className={styles.actionSub}>Daily reward</span>
        </Link>

        {/* Invite & Earn */}
        <Link to="/referral" className={styles.actionBtn}>
          <div className={`${styles.actionCircle} ${styles.actionInvite}`}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <span className={styles.actionLabel}>Invite &amp; Earn</span>
          <span className={styles.actionSub}>₱50 per friend</span>
        </Link>

      </div>

      {/* ── More Tasks ── */}
      <div className={styles.tasksSection}>
        <div className={styles.tasksHeader}>
          <span className={styles.tasksTitle}>More Tasks</span>
          <Link to="/tasks" className={styles.tasksLink}>See all →</Link>
        </div>

        {tasks.length === 0 ? (
          <div className={styles.emptyTasks}>
            <p>All tasks completed! 🎉</p>
            <Link to="/tasks" className={styles.walletBtn} style={{ marginTop: '0.75rem', display: 'inline-flex' }}>Browse Tasks</Link>
          </div>
        ) : (
          <div className={styles.taskGrid}>
            {tasks.map(task => (
              <div key={task.id} className={styles.taskCard}>
                <div className={styles.taskIcon}>{categoryIcon(task.category)}</div>
                <p className={styles.taskTitle}>{task.title}</p>
                <p className={styles.taskPayout}>+₱{task.payout}</p>
                <button className={styles.taskBtn} onClick={() => handleComplete(task)}>
                  {categoryAction(task.category)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function categoryIcon(cat: string) {
  const map: Record<string, string> = {
    survey: '📝', app_install: '📲', video: '🎥', microjob: '⚡', game: '🎮',
  };
  return map[cat] ?? '✅';
}

function categoryAction(cat: string) {
  const map: Record<string, string> = {
    survey: 'Take Survey', app_install: 'Install App', video: 'Watch Video', microjob: 'Do Task', game: 'Play Now',
  };
  return map[cat] ?? 'Complete';
}
