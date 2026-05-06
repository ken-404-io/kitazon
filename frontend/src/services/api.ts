import axios from 'axios';
import { getToken, setToken } from '../utils/tokenStore';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // sends httpOnly refresh_token cookie automatically
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios
    .post<{ token: string }>('/api/auth/refresh', {}, { withCredentials: true })
    .then((r) => { setToken(r.data.token); return r.data.token; })
    .catch(() => { setToken(null); return null; })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    // On 401, try silent refresh once — but not if the failing request IS the refresh endpoint
    if (err.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      const newToken = await tryRefresh();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh failed — send user to login
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
