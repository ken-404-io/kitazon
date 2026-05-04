import { useState } from 'react';
import api from '../../services/api';
import styles from './TaskCard.module.css';

const CATEGORY_ICONS = {
  survey: '📋',
  app_install: '📱',
  video: '🎬',
  microjob: '💼',
  game: '🎮',
};

export default function TaskCard({ task, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await api.post(`/tasks/${task.id}/complete`);
      setDone(true);
      if (onComplete) onComplete(task.payout);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`card ${styles.card} ${done ? styles.done : ''}`}>
      <div className={styles.header}>
        <span className={styles.icon}>{CATEGORY_ICONS[task.category] || '⭐'}</span>
        <span className={`badge badge-gold ${styles.payout}`}>₱{task.payout}</span>
      </div>
      <h4 className={styles.title}>{task.title}</h4>
      <p className={styles.desc}>{task.description}</p>
      <button
        className={done ? styles.doneBtn : 'btn-primary'}
        onClick={handleComplete}
        disabled={loading || done}
      >
        {done ? '✅ Completed' : loading ? 'Processing...' : 'Complete Task'}
      </button>
    </div>
  );
}
