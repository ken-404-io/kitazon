import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api, { refreshSession } from '../services/api';
import { getToken, setToken } from '../utils/tokenStore';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authTransition: 'idle' | 'signing-in' | 'signing-out';
  login: (email: string, password: string, captchaToken?: string, totpCode?: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  setUserFromToken: (user: User) => void;
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
  website?: string;
  _t?: string;
  _fp?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authTransition, setAuthTransition] = useState<'idle' | 'signing-in' | 'signing-out'>('idle');

  useEffect(() => {
    // On app load, try to restore the session via the httpOnly refresh cookie.
    // Only a definitive failure (null result) clears the session — a network blip
    // leaves the user logged in. Tokens live 60 days, so a returning visitor stays
    // signed in for the whole window.
    refreshSession()
      .then((res) => { if (res) setUser(res.user); else setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  // Keep the session warm while the tab is open. The access token is long-lived,
  // so this is just to rotate the rolling refresh window and pick up fresh user
  // data — the shared single-flight refresh prevents any rotation race.
  useEffect(() => {
    const interval = setInterval(() => {
      refreshSession().then((res) => { if (res) setUser(res.user); });
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Re-validate the session when the user returns to the tab. Never clear state on
  // failure here — a network blip should not look like a logout.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      refreshSession().then((res) => { if (res) setUser(res.user); });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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
      await new Promise<void>(resolve => setTimeout(resolve, 700));
    } finally {
      setAuthTransition('idle');
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<void> => {
    setAuthTransition('signing-in');
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/google', { id_token: idToken });
      setToken(res.data.token);
      setUser(res.data.user);
      await new Promise<void>(resolve => setTimeout(resolve, 700));
    } finally {
      setAuthTransition('idle');
    }
  };

  const setUserFromToken = (u: User): void => {
    setUser(u);
  };

  const register = async (data: RegisterData): Promise<void> => {
    setAuthTransition('signing-in');
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/register', data);
      setToken(res.data.token);
      setUser(res.data.user);
      await new Promise<void>(resolve => setTimeout(resolve, 700));
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
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      setAuthTransition('idle');
    }
  }, []);

  // Idle auto-logout is intentionally disabled: users have asked to stay signed in
  // for the full 60-day session window even after long periods away from the tab.

  const refreshUser = async (): Promise<void> => {
    const res = await api.get<User>('/auth/me');
    setUser(res.data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, authTransition, login, loginWithGoogle, setUserFromToken, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
