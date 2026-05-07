import { useState } from 'react';
import api from '../../services/api';
import { Task } from '../../types';
import styles from './TaskRow.module.css';

const sz = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const SurveyIcon  = () => <svg {...sz}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>;
const PhoneIcon   = () => <svg {...sz}><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1"/></svg>;
const PlayIcon    = () => <svg {...sz}><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const BriefIcon   = () => <svg {...sz}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>;
const GameIcon    = () => <svg {...sz}><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>;
const CheckIcon   = () => <svg {...sz} width={14} height={14}><polyline points="20 6 9 17 4 12"/></svg>;

const ICONS: Record<Task['category'], React.ReactNode> = {
  survey:      <SurveyIcon />,
  app_install: <PhoneIcon />,
  video:       <PlayIcon />,
  microjob:    <BriefIcon />,
  game:        <GameIcon />,
};

const CAT_LABEL: Record<Task['category'], string> = {
  survey:      'Survey',
  app_install: 'App Install',
  video:       'Watch Video',
  microjob:    'Micro-Job',
  game:        'Game',
};

interface Props {
  task: Task;
  onComplete?: (amount: number) => void;
}

export default function TaskRow({ task, onComplete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(task.is_completed ?? false);
  const [err, setErr]           = useState('');

  const pts = Math.round(parseFloat(String(task.payout)));

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (done || loading) return;
    setLoading(true); setErr('');
    try {
      await api.post(`/tasks/${task.id}/complete`, {});
      setDone(true);
      onComplete?.(Number(task.payout));
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      setErr(msg ?? 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div
      className={`${styles.row} ${done ? styles.rowCompleted : ''}`}
      onClick={() => setExpanded(v => !v)}
    >
      {/* Flag badge */}
      <div className={`${styles.flag} ${styles[`cat-${task.category}` as keyof typeof styles]}`}>
        <span className={styles.flagIcon}>{ICONS[task.category]}</span>
        <span className={styles.flagPoints}>{pts}</span>
        <span className={styles.flagLabel}>points</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className={styles.content}>
          <p className={styles.title}>{task.title}</p>
          <div className={styles.meta}>
            <span className={styles.category}>{CAT_LABEL[task.category]}</span>
            {done ? (
              <span className={styles.statusCompleted}>
                Completed <span className={`${styles.statusDot} ${styles.dotGreen}`} />
              </span>
            ) : (
              <span className={styles.statusPending}>
                Available <span className={`${styles.statusDot} ${styles.dotAmber}`} />
              </span>
            )}
          </div>
        </div>

        {expanded && (
          <div className={styles.detail} onClick={e => e.stopPropagation()}>
            <p className={styles.desc}>{task.description}</p>
            <p className={styles.payout}>Reward: ₱{parseFloat(String(task.payout)).toFixed(2)}</p>
            {err && <p style={{ fontSize: 12, color: 'var(--red)' }}>{err}</p>}
            {done ? (
              <span className={styles.doneChip}><CheckIcon /> Already completed</span>
            ) : (
              <button className={styles.completeBtn} onClick={handleComplete} disabled={loading}>
                {loading ? 'Processing…' : task.category === 'video' ? '▶ Watch & Earn' : 'Complete Task'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
