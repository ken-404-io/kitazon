import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../utils/tokenStore';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUserFromToken } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const userRaw = params.get('user');

    if (!token || !userRaw) {
      navigate('/login?error=google_failed', { replace: true });
      return;
    }

    try {
      const user: User = JSON.parse(decodeURIComponent(userRaw));
      setToken(token);
      setUserFromToken(user);
      navigate('/dashboard', { replace: true });
    } catch {
      navigate('/login?error=google_failed', { replace: true });
    }
  }, [navigate, setUserFromToken]);

  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gold)' }}>
      Signing you in…
    </div>
  );
}
