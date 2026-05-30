import axios from 'axios';
import { getToken, setToken } from '../utils/tokenStore';
import { User } from '../types';

const BASE = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface RefreshResult { token: string; user: User; }

// Single-flight session refresh. Every caller (the 401 interceptor below, the
// AuthProvider on mount / interval / tab focus) shares ONE in-flight request.
// This is critical: firing several /auth/refresh calls at once would each rotate
// the refresh-token cookie, and the losing requests would arrive carrying a token
// the winner just revoked — which the server used to treat as theft and log the
// user out everywhere. One shared promise eliminates that race within a tab.
let refreshPromise: Promise<RefreshResult | null> | null = null;

export function refreshSession(): Promise<RefreshResult | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios
    .post<RefreshResult>(`${BASE}/auth/refresh`, {}, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    })
    .then((r) => { setToken(r.data.token); return r.data as RefreshResult; })
    // Do NOT clear the token on a transient/network failure here — let the caller
    // decide. Clearing eagerly is what made brief blips look like a logout.
    .catch(() => null)
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      const result = await refreshSession();
      if (result?.token) {
        original.headers.Authorization = `Bearer ${result.token}`;
        return api(original);
      }
      setToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
