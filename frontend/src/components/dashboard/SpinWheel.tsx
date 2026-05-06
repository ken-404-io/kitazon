import { useState } from 'react';
import api from '../../services/api';
import styles from './SpinWheel.module.css';

interface Props {
  onWin?: (amount: number) => void;
}

export default function SpinWheel({ onWin }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState('');

  const spin = async (): Promise<void> => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    setError('');
    try {
      const res = await api.post<{ amount: number }>('/tasks/spin', {});
      setTimeout(() => {
        setResult(res.data.amount);
        setSpinning(false);
        onWin?.(res.data.amount);
      }, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Already spun today. Come back tomorrow!');
      setSpinning(false);
    }
  };

  return (
    <div className={`card ${styles.wrap}`}>
      <h3>Daily Spin Wheel</h3>
      <p className={styles.sub}>Spin once per day — win ₱5 to ₱100!</p>
      <div className={`${styles.wheel} ${spinning ? styles.spinning : ''}`}>
        {spinning ? '🌀' : result ? `₱${result}` : '💰'}
      </div>
      {result !== null && <p className={styles.win}>You won ₱{result}! 🎉</p>}
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={spin} disabled={spinning}>
        {spinning ? 'Spinning...' : 'Spin Now'}
      </button>
    </div>
  );
}
