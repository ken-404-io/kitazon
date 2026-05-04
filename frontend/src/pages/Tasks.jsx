import { useEffect, useState } from 'react';
import TaskCard from '../components/tasks/TaskCard';
import api from '../services/api';
import styles from './Tasks.module.css';

const CATEGORIES = ['all', 'survey', 'app_install', 'video', 'microjob', 'game'];
const CATEGORY_LABELS = { all: 'All', survey: 'Surveys', app_install: 'App Installs', video: 'Videos', microjob: 'Micro-Jobs', game: 'Games' };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [totalEarned, setTotalEarned] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = category !== 'all' ? `?category=${category}` : '';
    api.get(`/tasks${params}`)
      .then(res => setTasks(res.data))
      .finally(() => setLoading(false));
  }, [category]);

  const handleComplete = (amount) => {
    setTotalEarned(p => p + parseFloat(amount));
  };

  return (
    <div className="page-container">
      <div className={styles.header}>
        <div>
          <h1>Available Tasks</h1>
          <p className={styles.sub}>Complete tasks to earn ₱15 – ₱500 each</p>
        </div>
        {totalEarned > 0 && (
          <div className={`card ${styles.sessionEarned}`}>
            Session Earned: <strong>₱{totalEarned.toFixed(2)}</strong>
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={category === c ? styles.activeTab : styles.tab}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={styles.loading}>Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <p className={styles.loading}>No tasks available in this category right now.</p>
      ) : (
        <div className="grid-3">
          {tasks.map(t => <TaskCard key={t.id} task={t} onComplete={handleComplete} />)}
        </div>
      )}
    </div>
  );
}
