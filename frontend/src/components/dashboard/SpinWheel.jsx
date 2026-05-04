import { useState } from 'react';
import api from '../../services/api';
import styles from './SpinWheel.module.css';

const PRIZES = [5, 10, 15, 20, 25, 50, 75, 100];

export default function SpinWheel({ onWin }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    setError('');
    try {
      const res = await api.post('/tasks/spin');
      setTimeout(() => {
        setResult(res.data.amount);
        setSpinning(false);
        if (onWin) onWin(res.data.amount);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Already spun today. Come back tomorrow!');
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
      {result && <p className={styles.win}>You won ₱{result}! 🎉</p>}
      {error && <p className="error-msg">{error}</p>}
      <button className="btn-primary" onClick={spin} disabled={spinning}>
        {spinning ? 'Spinning...' : 'Spin Now'}
      </button>
    </div>
  );
}
