import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { WithdrawalStatus, WithdrawalChannel } from '../types';

type Tab = 'stats' | 'users' | 'withdrawals' | 'tasks' | 'logs';

interface PlatformStats {
  users: number;
  active_users: number;
  verified_users: number;
  pending_withdrawals: number;
  total_paid_out: number;
  total_earnings_distributed: number;
}

type PlanValue = 'free' | 'silver' | 'gold' | 'diamond';

const PLAN_COLORS: Record<PlanValue, string> = {
  free: '#6b7280',
  silver: '#9ca3af',
  gold: '#f59e0b',
  diamond: '#60a5fa',
};

interface AdminUser {
  id: number;
  name: string;
  email: string;
  balance: number | string;
  is_active: boolean;
  is_admin: boolean;
  email_verified: boolean;
  created_at: string;
  last_login_at: string | null;
  plan?: string;
  plan_expires_at?: string | null;
}

interface AdminWithdrawal {
  id: number;
  amount: number | string;
  fee: number | string;
  net_amount: number | string;
  channel: WithdrawalChannel;
  account_number: string;
  status: WithdrawalStatus;
  created_at: string;
  user_id: number;
  user_name: string;
  user_email: string;
}

interface AdminTask {
  id: number;
  title: string;
  description: string;
  category: string;
  payout: number | string;
  is_active: boolean;
}

interface AuditLog {
  id: number;
  action: string;
  amount: number | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

const fmt = (n: number | string) => Number(n).toFixed(2);
const STATUS_COLORS: Record<string, string> = {
  pending: '#d97706', processing: '#2563eb', completed: '#16a34a', failed: '#dc2626',
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('stats');

  // Stats
  const [stats, setStats] = useState<PlatformStats | null>(null);

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userLoading, setUserLoading] = useState(false);

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [wPage, setWPage] = useState(1);
  const [wPages, setWPages] = useState(1);
  const [wFilter, setWFilter] = useState('');
  const [wLoading, setWLoading] = useState(false);

  // Tasks
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', category: 'survey', payout: '' });
  const [taskError, setTaskError] = useState('');
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);

  // Audit logs
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logPages, setLogPages] = useState(1);
  const [logLoading, setLogLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Redirect non-admins
  useEffect(() => {
    if (user && !user.is_admin) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const loadStats = useCallback(async () => {
    const res = await api.get<PlatformStats>('/admin/stats');
    setStats(res.data);
  }, []);

  const loadUsers = useCallback(async (page: number, search: string) => {
    setUserLoading(true);
    try {
      const res = await api.get<{ users: AdminUser[]; total: number; pages: number }>(
        `/admin/users?page=${page}&search=${encodeURIComponent(search)}`
      );
      setUsers(res.data.users);
      setUserPages(res.data.pages);
    } finally { setUserLoading(false); }
  }, []);

  const loadWithdrawals = useCallback(async (page: number, status: string) => {
    setWLoading(true);
    try {
      const res = await api.get<{ withdrawals: AdminWithdrawal[]; pages: number }>(
        `/admin/withdrawals?page=${page}${status ? `&status=${status}` : ''}`
      );
      setWithdrawals(res.data.withdrawals);
      setWPages(res.data.pages);
    } finally { setWLoading(false); }
  }, []);

  const loadTasks = useCallback(async () => {
    setTaskLoading(true);
    try {
      const res = await api.get<AdminTask[]>('/admin/tasks');
      setTasks(res.data);
    } finally { setTaskLoading(false); }
  }, []);

  const loadLogs = useCallback(async (page: number) => {
    setLogLoading(true);
    try {
      const res = await api.get<{ logs: AuditLog[]; pages: number }>(`/admin/audit-logs?page=${page}`);
      setLogs(res.data.logs);
      setLogPages(res.data.pages);
    } finally { setLogLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'stats' && !stats) loadStats();
    if (tab === 'users') loadUsers(userPage, userSearch);
    if (tab === 'withdrawals') loadWithdrawals(wPage, wFilter);
    if (tab === 'tasks') loadTasks();
    if (tab === 'logs') loadLogs(logPage);
  }, [tab, userPage, wPage, wFilter, logPage, stats, loadStats, loadUsers, loadWithdrawals, loadTasks, loadLogs]);

  const toggleActive = async (userId: number) => {
    await api.patch(`/admin/users/${userId}/toggle-active`);
    loadUsers(userPage, userSearch);
  };

  const changePlan = async (userId: number, plan: PlanValue) => {
    await api.patch(`/admin/users/${userId}/plan`, { plan });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u));
    showToast(`Plan updated to ${plan}`);
  };

  const updateWStatus = async (id: number, status: string) => {
    await api.patch(`/admin/withdrawals/${id}/status`, { status });
    loadWithdrawals(wPage, wFilter);
  };

  const tabStyle = (t: Tab) => ({
    padding: '8px 18px',
    background: tab === t ? 'var(--gold)' : 'transparent',
    color: tab === t ? '#000' : 'inherit',
    border: '1px solid var(--gold)',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: tab === t ? 700 : 400,
  });

  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1rem' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#16a34a', color: '#fff', padding: '10px 18px', borderRadius: 8, zIndex: 9999, fontWeight: 600 }}>
          {toast}
        </div>
      )}
      <h2>Admin Panel</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['stats', 'users', 'withdrawals', 'tasks', 'logs'] as Tab[]).map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Stats ── */}
      {tab === 'stats' && (
        <div>
          {!stats ? <p>Loading...</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Total Users', value: stats.users },
                { label: 'Active Users', value: stats.active_users },
                { label: 'Verified Users', value: stats.verified_users },
                { label: 'Pending Withdrawals', value: stats.pending_withdrawals },
                { label: 'Total Paid Out', value: `₱${fmt(stats.total_paid_out)}` },
                { label: 'Total Earnings Distributed', value: `₱${fmt(stats.total_earnings_distributed)}` },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
            <input
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
              onKeyDown={e => { if (e.key === 'Enter') loadUsers(1, userSearch); }}
            />
            <button className="btn-primary" onClick={() => loadUsers(1, userSearch)}>Search</button>
          </div>
          {userLoading ? <p>Loading...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    {['ID', 'Name', 'Email', 'Balance', 'Plan', 'Verified', 'Active', 'Joined', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px' }}>{u.id}</td>
                      <td style={{ padding: '8px 10px' }}>{u.name}</td>
                      <td style={{ padding: '8px 10px' }}>{u.email}</td>
                      <td style={{ padding: '8px 10px' }}>₱{fmt(u.balance)}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          background: PLAN_COLORS[(u.plan ?? 'free') as PlanValue] + '22',
                          color: PLAN_COLORS[(u.plan ?? 'free') as PlanValue],
                          border: `1px solid ${PLAN_COLORS[(u.plan ?? 'free') as PlanValue]}`,
                          marginBottom: 4,
                          textTransform: 'uppercase',
                        }}>
                          {u.plan ?? 'free'}
                        </span>
                        <br />
                        <select
                          value={u.plan ?? 'free'}
                          onChange={e => changePlan(u.id, e.target.value as PlanValue)}
                          style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid #e5e7eb', marginTop: 2 }}
                        >
                          <option value="free">free</option>
                          <option value="silver">silver</option>
                          <option value="gold">gold</option>
                          <option value="diamond">diamond</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px 10px', color: u.email_verified ? 'green' : '#d97706' }}>
                        {u.email_verified ? 'Yes' : 'No'}
                      </td>
                      <td style={{ padding: '8px 10px', color: u.is_active ? 'green' : '#dc2626' }}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {!u.is_admin && (
                          <button
                            className="btn-outline"
                            style={{ fontSize: 12, padding: '4px 10px', borderColor: u.is_active ? '#dc2626' : 'green', color: u.is_active ? '#dc2626' : 'green' }}
                            onClick={() => toggleActive(u.id)}
                          >
                            {u.is_active ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: '1rem', alignItems: 'center' }}>
            <button className="btn-outline" disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>Prev</button>
            <span style={{ fontSize: 13 }}>Page {userPage} of {userPages}</span>
            <button className="btn-outline" disabled={userPage >= userPages} onClick={() => setUserPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* ── Withdrawals ── */}
      {tab === 'withdrawals' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: 13 }}>Filter by status:</label>
            <select
              value={wFilter}
              onChange={e => { setWFilter(e.target.value); setWPage(1); }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          {wLoading ? <p>Loading...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    {['ID', 'User', 'Amount', 'Net', 'Channel', 'Account', 'Status', 'Date', 'Update Status'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map(w => (
                    <tr key={w.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px' }}>{w.id}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div>{w.user_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{w.user_email}</div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>₱{fmt(w.amount)}</td>
                      <td style={{ padding: '8px 10px' }}>₱{fmt(w.net_amount)}</td>
                      <td style={{ padding: '8px 10px' }}>{w.channel.toUpperCase()}</td>
                      <td style={{ padding: '8px 10px' }}>{w.account_number}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ color: STATUS_COLORS[w.status] ?? '#374151', fontWeight: 600 }}>
                          {w.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          value={w.status}
                          onChange={e => updateWStatus(w.id, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 12 }}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="completed">Completed</option>
                          <option value="failed">Failed</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: '1rem', alignItems: 'center' }}>
            <button className="btn-outline" disabled={wPage <= 1} onClick={() => setWPage(p => p - 1)}>Prev</button>
            <span style={{ fontSize: 13 }}>Page {wPage} of {wPages}</span>
            <button className="btn-outline" disabled={wPage >= wPages} onClick={() => setWPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* ── Tasks ── */}
      {tab === 'tasks' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>{editingTask ? 'Edit Task' : 'Add New Task'}</h3>
            <form onSubmit={async (e) => {
              e.preventDefault(); setTaskError('');
              try {
                if (editingTask) {
                  await api.patch(`/admin/tasks/${editingTask.id}`, { ...taskForm, payout: Number(taskForm.payout) });
                  setEditingTask(null);
                } else {
                  await api.post('/admin/tasks', { ...taskForm, payout: Number(taskForm.payout) });
                }
                setTaskForm({ title: '', description: '', category: 'survey', payout: '' });
                loadTasks();
              } catch (err: unknown) {
                setTaskError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.');
              }
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Title</label>
                  <input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} required maxLength={120} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Category</label>
                  <select value={taskForm.category} onChange={e => setTaskForm(p => ({ ...p, category: e.target.value }))} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)', width: '100%' }}>
                    {['survey', 'app_install', 'video', 'microjob', 'game'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} required maxLength={300} />
              </div>
              <div className="form-group">
                <label>Payout (₱)</label>
                <input type="number" value={taskForm.payout} onChange={e => setTaskForm(p => ({ ...p, payout: e.target.value }))} required min={1} max={500} step={0.01} />
              </div>
              {taskError && <p className="error-msg">{taskError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" type="submit">{editingTask ? 'Save Changes' : 'Add Task'}</button>
                {editingTask && <button type="button" className="btn-outline" onClick={() => { setEditingTask(null); setTaskForm({ title: '', description: '', category: 'survey', payout: '' }); }}>Cancel</button>}
              </div>
            </form>
          </div>

          {taskLoading ? <p>Loading...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    {['ID', 'Title', 'Category', 'Payout', 'Active', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: t.is_active ? 1 : 0.5 }}>
                      <td style={{ padding: '8px 10px' }}>{t.id}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 200 }}>{t.title}</td>
                      <td style={{ padding: '8px 10px' }}>{t.category}</td>
                      <td style={{ padding: '8px 10px' }}>₱{fmt(t.payout)}</td>
                      <td style={{ padding: '8px 10px', color: t.is_active ? 'green' : '#dc2626' }}>{t.is_active ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
                        <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { setEditingTask(t); setTaskForm({ title: t.title, description: t.description, category: t.category, payout: String(t.payout) }); }}>Edit</button>
                        <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px', borderColor: t.is_active ? '#dc2626' : 'green', color: t.is_active ? '#dc2626' : 'green' }} onClick={async () => { await api.patch(`/admin/tasks/${t.id}`, { is_active: !t.is_active }); loadTasks(); }}>{t.is_active ? 'Disable' : 'Enable'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Audit Logs ── */}
      {tab === 'logs' && (
        <div>
          {logLoading ? <p>Loading...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    {['Time', 'User', 'Action', 'Amount', 'IP', 'Details'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div>{l.user_name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{l.user_email ?? ''}</div>
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{l.action}</td>
                      <td style={{ padding: '8px 10px' }}>{l.amount != null ? `₱${fmt(l.amount)}` : '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{l.ip_address ?? '—'}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.metadata ? JSON.stringify(l.metadata) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: '1rem', alignItems: 'center' }}>
            <button className="btn-outline" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>Prev</button>
            <span style={{ fontSize: 13 }}>Page {logPage} of {logPages}</span>
            <button className="btn-outline" disabled={logPage >= logPages} onClick={() => setLogPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
