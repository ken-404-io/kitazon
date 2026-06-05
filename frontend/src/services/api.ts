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

// Refresh outcome contract:
//   • RefreshResult → success (new access token + user).
//   • null          → DEFINITIVE failure: the server rejected the refresh cookie
//                     (401/403), so the session is genuinely gone. Callers should
//                     clear local state and send the user to /login.
//   • throws        → TRANSIENT failure (network blip, 5xx, CORS hiccup). The
//                     session may still be perfectly valid, so callers MUST NOT log
//                     the user out — that's what made brief blips look like a logout.
export function refreshSession(): Promise<RefreshResult | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios
    .post<RefreshResult>(`${BASE}/auth/refresh`, {}, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    })
    .then((r) => { setToken(r.data.token); return r.data as RefreshResult; })
    .catch((e) => {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return null; // session truly invalid
      throw e;                                            // transient — keep session
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      try {
        const result = await refreshSession();
        if (result?.token) {
          original.headers.Authorization = `Bearer ${result.token}`;
          return api(original);
        }
        // null = the refresh was definitively rejected — the session is gone.
        setToken(null);
        window.location.href = '/login';
      } catch {
        // Transient refresh failure (network/5xx). Do NOT log the user out — just
        // surface the original error so the caller can retry. The session stands.
      }
    }
    return Promise.reject(err);
  }
);

export default api;
