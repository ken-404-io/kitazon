import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../services/api';
import { getToken, setToken } from '../utils/tokenStore';
import { useIdleLogout } from '../hooks/useIdleLogout';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authTransition: 'idle' | 'signing-in' | 'signing-out';
  login: (email: string, password: string, captchaToken?: string, totpCode?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  referral_code?: string;
  captcha_token?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authTransition, setAuthTransition] = useState<'idle' | 'signing-in' | 'signing-out'>('idle');

  useEffect(() => {
    // On app load, try to restore session via httpOnly cookie (silent refresh)
    api.post<{ token: string; user: User }>('/auth/refresh', {})
      .then((res) => { setToken(res.data.token); setUser(res.data.user); })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, captchaToken?: string, totpCode?: string): Promise<void> => {
    setAuthTransition('signing-in');
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/login', {
        email, password,
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
        ...(totpCode ? { totp_code: totpCode } : {}),
      });
      setToken(res.data.token);
      setUser(res.data.user);
      // Keep overlay visible briefly so it covers the route change
      await new Promise(r => setTimeout(r, 700));
    } finally {
      setAuthTransition('idle');
    }
  };

  const register = async (data: RegisterData): Promise<void> => {
    setAuthTransition('signing-in');
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/register', data);
      setToken(res.data.token);
      setUser(res.data.user);
      await new Promise(r => setTimeout(r, 700));
    } finally {
      setAuthTransition('idle');
    }
  };

  const logout = useCallback(async (): Promise<void> => {
    setAuthTransition('signing-out');
    try {
      if (getToken()) await api.post('/auth/logout', {});
    } catch {
      // Best-effort
    } finally {
      setToken(null);
      setUser(null);
      await new Promise(r => setTimeout(r, 500));
      setAuthTransition('idle');
    }
  }, []);

  // Auto-logout after 30 minutes of inactivity (only when logged in)
  useIdleLogout(logout, !!user);

  const refreshUser = async (): Promise<void> => {
    const res = await api.get<User>('/auth/me');
    setUser(res.data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, authTransition, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
