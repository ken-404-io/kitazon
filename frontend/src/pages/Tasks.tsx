import { useEffect, useState } from 'react';
import TaskRow from '../components/tasks/TaskRow';
import api from '../services/api';
import { Task } from '../types';
import styles from './Tasks.module.css';

type StatusTab = 'all' | 'pending' | 'completed';
type Category  = Task['category'] | 'all';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all',       label: 'ALL' },
  { key: 'pending',   label: 'PENDING' },
  { key: 'completed', label: 'COMPLETED' },
];

const CATS: { key: Category; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'video',       label: '▶ Videos' },
  { key: 'survey',      label: 'Surveys' },
  { key: 'app_install', label: 'App Installs' },
  { key: 'microjob',    label: 'Micro-Jobs' },
  { key: 'game',        label: 'Games' },
];

const sz = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const MenuIcon = () => <svg {...sz}><line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const BellIcon = () => <svg {...sz}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
const TaskIcon = () => <svg {...sz}><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M7 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-2"/><path d="M9 12l2 2 4-4"/></svg>;

export default function Tasks() {
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [statusTab,    setStatusTab]    = useState<StatusTab>('all');
  const [category,     setCategory]     = useState<Category>('all');
  const [loading,      setLoading]      = useState(true);
  const [sessionEarned,setSessionEarned]= useState(0);

  useEffect(() => {
    setLoading(true);
    api.get<Task[]>('/tasks')
      .then(r => setTasks(r.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tasks.filter(t => {
    const catOk = category === 'all' || t.category === category;
    const statusOk =
      statusTab === 'all'       ? true :
      statusTab === 'completed' ? t.is_completed :
      /* pending */               !t.is_completed;
    return catOk && statusOk;
  });

  const completedCount = tasks.filter(t => t.is_completed).length;
  const pendingCount   = tasks.filter(t => !t.is_completed).length;

  const handleComplete = (id: number, amount: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_completed: true } : t));
    setSessionEarned(p => p + amount);
  };

  return (
    <div className="page-container">

      {/* Header */}
      <div className={styles.pageHeader}>
        <button className={styles.menuBtn}><MenuIcon /></button>
        <span className={styles.pageTitle}>My Tasks</span>
        <button className={styles.bellBtn}><BellIcon /></button>
      </div>

      {/* Summary chips */}
      <div className={styles.summary}>
        <div className={styles.summaryChip}>
          <p className={styles.chipVal}>{tasks.length}</p>
          <p className={styles.chipLabel}>Total Tasks</p>
        </div>
        <div className={styles.summaryChip}>
          <p className={styles.chipVal}>{pendingCount}</p>
          <p className={styles.chipLabel}>Pending</p>
        </div>
        <div className={styles.summaryChip}>
          <p className={styles.chipVal}>{completedCount}</p>
          <p className={styles.chipLabel}>Completed</p>
        </div>
        {sessionEarned > 0 && (
          <div className={styles.summaryChip}>
            <p className={styles.chipVal}>₱{sessionEarned.toFixed(2)}</p>
            <p className={styles.chipLabel}>Earned</p>
          </div>
        )}
      </div>

      {/* Status tab bar */}
      <div className={styles.tabBar}>
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            className={statusTab === key ? styles.activeTab : styles.tab}
            onClick={() => setStatusTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className={styles.catBar}>
        {CATS.map(({ key, label }) => (
          <button
            key={key}
            className={category === key ? styles.activeCatChip : styles.catChip}
            onClick={() => setCategory(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <p className={styles.loading}>Loading tasks…</p>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><TaskIcon /></div>
          <p className={styles.emptyText}>
            {statusTab === 'completed'
              ? "You haven't completed any tasks yet."
              : statusTab === 'pending'
              ? 'No pending tasks in this category.'
              : 'No tasks available right now.'}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map(t => (
            <TaskRow
              key={t.id}
              task={t}
              onComplete={amount => handleComplete(t.id, amount)}
            />
          ))}
        </div>
      )}

    </div>
  );
}
