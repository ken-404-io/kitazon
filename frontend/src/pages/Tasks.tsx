import { useEffect, useState } from 'react';
import TaskCard from '../components/tasks/TaskCard';
import api from '../services/api';
import { Task } from '../types';
import styles from './Tasks.module.css';

type Category = Task['category'] | 'all';

const CATEGORIES: Category[] = ['all', 'survey', 'app_install', 'video', 'microjob', 'game'];
const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All',
  survey: 'Surveys',
  app_install: 'App Installs',
  video: 'Videos',
  microjob: 'Micro-Jobs',
  game: 'Games',
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [category, setCategory] = useState<Category>('all');
  const [loading, setLoading] = useState(true);
  const [totalEarned, setTotalEarned] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = category !== 'all' ? `?category=${category}` : '';
    api.get<Task[]>(`/tasks${params}`)
      .then((res) => setTasks(res.data))
      .finally(() => setLoading(false));
  }, [category]);

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
        {CATEGORIES.map((c) => (
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
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onComplete={(amount) => setTotalEarned((p) => p + Number(amount))} />
          ))}
        </div>
      )}
    </div>
  );
}
