import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { getToken, setToken } from '../utils/tokenStore';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
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

  useEffect(() => {
    // On app load, try to restore session via httpOnly cookie (silent refresh)
    api.post<{ token: string; user: User }>('/auth/refresh', {})
      .then((res) => { setToken(res.data.token); setUser(res.data.user); })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, captchaToken?: string, totpCode?: string): Promise<void> => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', {
      email, password,
      ...(captchaToken ? { captcha_token: captchaToken } : {}),
      ...(totpCode ? { totp_code: totpCode } : {}),
    });
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const register = async (data: RegisterData): Promise<void> => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', data);
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const logout = async (): Promise<void> => {
    try {
      if (getToken()) await api.post('/auth/logout', {});
    } catch {
      // Best-effort
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async (): Promise<void> => {
    const res = await api.get<User>('/auth/me');
    setUser(res.data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
