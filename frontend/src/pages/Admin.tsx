import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { WithdrawalStatus, WithdrawalChannel } from '../types';

type Tab = 'stats' | 'users' | 'withdrawals' | 'pending-withdrawals' | 'tasks' | 'logs' | 'revenue' | 'broadcast' | 'kyc' | 'online' | 'gcash-payments';

const TAB_LABELS: Record<Tab, string> = {
  stats: 'Stats',
  revenue: 'Revenue',
  users: 'Users',
  'pending-withdrawals': 'Pending Withdrawals',
  withdrawals: 'All Withdrawals',
  tasks: 'Tasks',
  kyc: 'KYC',
  'gcash-payments': 'GCash Payments',
  online: 'Online',
  logs: 'Audit Logs',
  broadcast: 'Broadcast',
};

interface OnlineUser {
  id: number;
  name: string;
  email: string;
  plan: string;
  last_active_at: string;
}

interface KycSubmission {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  full_name: string;
  date_of_birth: string;
  nationality: string;
  id_type: string;
  id_number: string;
  address: string;
  city: string;
  province: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  tags: string[] | string;
  id_front_data: string | null;
  id_back_data: string | null;
  selfie_data: string | null;
}

interface GcashPayment {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  plan: string;
  amount: string;
  reference: string;
  screenshot_url: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

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
  account_name: string | null;
  status: WithdrawalStatus;
  created_at: string;
  user_id: number;
  user_name: string;
  user_email: string;
  daily_completed_count: number;
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

interface RevenueStats {
  plan_counts: { free: number; silver: number; gold: number; diamond: number };
  active_subscribers: number;
  total_paid_out: number;
  total_earnings_distributed: number;
  new_users_30d: number;
}

const fmt = (n: number | string) => Number(n).toFixed(2);
const fmtPhone = (num: string) => {
  const d = num.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return num;
};
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
  const [selectedW, setSelectedW] = useState<Set<number>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

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

  // Revenue
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Balance adjustment
  const [adjustingUser, setAdjustingUser] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Broadcast
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'verified' | 'paid'>('all');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // Bulk Import
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkJson, setBulkJson] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // KYC
  const [kycList, setKycList] = useState<KycSubmission[]>([]);
  const [kycFilter, setKycFilter] = useState('pending');
  const [kycLoading, setKycLoading] = useState(false);
  const [kycRejectId, setKycRejectId] = useState<number | null>(null);
  const [kycRejectReason, setKycRejectReason] = useState('');

  // Referral count edit
  const [editingReferrals, setEditingReferrals] = useState<number | null>(null);
  const [referralInput, setReferralInput] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);

  // GCash Payments
  const [gcashPayments, setGcashPayments] = useState<GcashPayment[]>([]);
  const [gcashFilter, setGcashFilter] = useState('pending');
  const [gcashLoading, setGcashLoading] = useState(false);
  const [gcashPreview, setGcashPreview] = useState<string | null>(null);

  // Online users
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);

  // Leaderboard Rewards
  const [rewardsConfirming, setRewardsConfirming] = useState(false);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsResult, setRewardsResult] = useState<string | null>(null);

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

  // Reset pagination and selection when entering either withdrawals view,
  // so state from the other view doesn't carry over to a smaller result set.
  useEffect(() => {
    if (tab === 'withdrawals' || tab === 'pending-withdrawals') {
      setWPage(1);
      setSelectedW(new Set());
    }
  }, [tab]);

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

  const loadRevenue = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const res = await api.get<RevenueStats>('/admin/revenue');
      setRevenueStats(res.data);
    } finally { setRevenueLoading(false); }
  }, []);

  const loadKyc = useCallback(async (status: string) => {
    setKycLoading(true);
    try {
      const res = await api.get<KycSubmission[]>(`/kyc/admin?status=${status}`);
      setKycList(res.data);
    } finally { setKycLoading(false); }
  }, []);

  const loadGcashPayments = useCallback(async (status: string) => {
    setGcashLoading(true);
    try {
      const res = await api.get<GcashPayment[]>(`/admin/gcash-payments?status=${status}`);
      setGcashPayments(res.data);
    } finally { setGcashLoading(false); }
  }, []);

  const loadOnline = useCallback(async () => {
    setOnlineLoading(true);
    try {
      const res = await api.get<{ count: number; users: OnlineUser[] }>('/admin/online');
      setOnlineCount(res.data.count);
      setOnlineUsers(res.data.users);
    } finally { setOnlineLoading(false); }
  }, []);

  // Load platform stats once on mount so the "Pending Withdrawals (N)"
  // tab badge stays accurate even before the Stats tab has been opened.
  useEffect(() => {
    if (user?.is_admin && !stats) loadStats();
  }, [user, stats, loadStats]);

  useEffect(() => {
    if (tab === 'stats' && !stats) loadStats();
    if (tab === 'users') loadUsers(userPage, userSearch);
    if (tab === 'withdrawals') loadWithdrawals(wPage, wFilter);
    if (tab === 'pending-withdrawals') loadWithdrawals(wPage, 'pending');
    if (tab === 'tasks') loadTasks();
    if (tab === 'logs') loadLogs(logPage);
    if (tab === 'revenue' && !revenueStats) loadRevenue();
    if (tab === 'kyc') loadKyc(kycFilter);
    if (tab === 'gcash-payments') loadGcashPayments(gcashFilter);
    if (tab === 'online') loadOnline();
  }, [tab, userPage, wPage, wFilter, logPage, kycFilter, gcashFilter, stats, revenueStats, loadStats, loadUsers, loadWithdrawals, loadTasks, loadLogs, loadRevenue, loadKyc, loadGcashPayments, loadOnline]);

  // Auto-refresh online tab every 30 seconds
  useEffect(() => {
    if (tab !== 'online') return;
    const interval = setInterval(loadOnline, 30_000);
    return () => clearInterval(interval);
  }, [tab, loadOnline]);

  const toggleActive = async (userId: number) => {
    await api.patch(`/admin/users/${userId}/toggle-active`);
    loadUsers(userPage, userSearch);
  };

  const changePlan = async (userId: number, plan: PlanValue) => {
    await api.patch(`/admin/users/${userId}/plan`, { plan });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u));
    showToast(`Plan updated to ${plan}`);
  };

  const adjustBalance = async (userId: number) => {
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || adjustNote.trim() === '') {
      showToast('Amount and note are required.'); return;
    }
    setAdjustLoading(true);
    try {
      await api.post(`/admin/users/${userId}/balance`, { amount, note: adjustNote.trim() });
      showToast(`Balance adjusted by ₱${amount.toFixed(2)}`);
      setAdjustingUser(null); setAdjustAmount(''); setAdjustNote('');
      loadUsers(userPage, userSearch);
    } catch (err: unknown) {
      showToast((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to adjust balance.');
    } finally { setAdjustLoading(false); }
  };

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastLoading(true); setBroadcastResult(null);
    try {
      const res = await api.post<{ queued: number }>('/admin/broadcast', {
        target: broadcastTarget,
        subject: broadcastSubject,
        message: broadcastMessage,
      });
      setBroadcastResult(`Done! ${res.data.queued} email${res.data.queued !== 1 ? 's' : ''} queued.`);
      setBroadcastSubject(''); setBroadcastMessage('');
    } catch (err: unknown) {
      setBroadcastResult((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Broadcast failed.');
    } finally { setBroadcastLoading(false); }
  };

  const updateWStatus = async (id: number, status: string) => {
    // When approving (completed) or marking failed, give the admin a chance to
    // attach a message that the user will see in their notification email.
    let message: string | undefined;
    if (status === 'completed' || status === 'failed') {
      const prompted = window.prompt(
        `Optional message to include in the user's ${status} notification email. Leave blank to skip.`,
        ''
      );
      if (prompted === null) return; // admin cancelled
      const trimmed = prompted.trim();
      if (trimmed) message = trimmed.slice(0, 1000);
    }
    await api.patch(`/admin/withdrawals/${id}/status`, message ? { status, message } : { status });
    loadWithdrawals(wPage, wFilter);
  };

  // Pending and processing rows are eligible for bulk approve.
  const selectableApprovable = withdrawals.filter(w => w.status === 'pending' || w.status === 'processing');
  const toggleSelectW = (id: number) => {
    setSelectedW(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAllVisible = () => {
    setSelectedW(prev => {
      const allIds = selectableApprovable.map(w => w.id);
      const allSelected = allIds.length > 0 && allIds.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        allIds.forEach(id => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      allIds.forEach(id => next.add(id));
      return next;
    });
  };
  const selectedRows = withdrawals.filter(w => selectedW.has(w.id) && (w.status === 'pending' || w.status === 'processing'));
  const selectedTotal = selectedRows.reduce((s, w) => s + Number(w.net_amount), 0);

  const [approveMessage, setApproveMessage] = useState('');

  const triggerBulkApprove = async () => {
    if (selectedRows.length === 0) return;
    const messagePreview = approveMessage.trim() ? `\n\nUser will see this message in their email:\n"${approveMessage.trim()}"` : '';
    if (!window.confirm(
      `Approve ${selectedRows.length} withdrawal${selectedRows.length === 1 ? '' : 's'} (₱${selectedTotal.toFixed(2)} total)?\n\n` +
      `Each user will be notified by email. Sending is throttled to one email every 5 seconds.${messagePreview}`
    )) return;
    setBatchBusy(true);
    try {
      const res = await api.post<{ message: string; approved_count: number; approved_ids: number[]; skipped_ids?: number[] }>(
        '/admin/withdrawals/bulk-approve',
        {
          withdrawal_ids: selectedRows.map(w => w.id),
          message: approveMessage.trim() || undefined,
        },
      );
      const skippedNote = res.data.skipped_ids && res.data.skipped_ids.length > 0 ? ` · ${res.data.skipped_ids.length} skipped` : '';
      const emailNote = res.data.approved_count > 0
        ? ` · emails sending over ~${Math.max(0, res.data.approved_count - 1) * 5}s`
        : '';
      setToast(`Approved ${res.data.approved_count}${skippedNote}.${emailNote}`);
      setTimeout(() => setToast(''), 6000);
      setSelectedW(new Set());
      setApproveMessage('');
      loadWithdrawals(wPage, wFilter);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Bulk approve failed.';
      setToast(msg);
      setTimeout(() => setToast(''), 5000);
    } finally {
      setBatchBusy(false);
    }
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
        {(['stats', 'revenue', 'users', 'pending-withdrawals', 'withdrawals', 'tasks', 'kyc', 'gcash-payments', 'online', 'logs', 'broadcast'] as Tab[]).map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t === 'online'
              ? `🟢 ${TAB_LABELS[t]}${onlineCount !== null ? ` (${onlineCount})` : ''}`
              : t === 'pending-withdrawals'
                ? `⏳ ${TAB_LABELS[t]}${stats?.pending_withdrawals ? ` (${stats.pending_withdrawals})` : ''}`
                : TAB_LABELS[t]}
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

          {/* Leaderboard Rewards */}
          <div style={{ marginTop: '1.5rem' }}>
            {!rewardsConfirming ? (
              <button
                className="btn-outline"
                style={{ borderColor: '#f59e0b', color: '#f59e0b', fontSize: 14, padding: '8px 18px' }}
                onClick={() => { setRewardsConfirming(true); setRewardsResult(null); }}
              >
                🏆 Grant Monthly Rewards
              </button>
            ) : (
              <div className="card" style={{ maxWidth: 480 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: '0.75rem' }}>
                  Award ₱500/₱200/₱100 to this month's top 3 earners?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-primary"
                    style={{ fontSize: 13, padding: '6px 16px' }}
                    disabled={rewardsLoading}
                    onClick={async () => {
                      setRewardsLoading(true); setRewardsResult(null);
                      try {
                        const res = await api.post<{ winners: Array<{ rank: number; name: string; amount: number }> }>('/admin/leaderboard-rewards', {});
                        const winners = res.data.winners ?? [];
                        const labels = winners.map((w: { rank: number; name: string; amount: number }) => `${w.rank === 1 ? '1st' : w.rank === 2 ? '2nd' : '3rd'} ${w.name} (₱${w.amount})`);
                        setRewardsResult(`Rewards granted to: ${labels.join(', ')}`);
                        setRewardsConfirming(false);
                      } catch (err: unknown) {
                        const apiErr = err as { response?: { data?: { message?: string } } };
                        setRewardsResult(apiErr.response?.data?.message ?? 'Failed to grant rewards.');
                        setRewardsConfirming(false);
                      } finally { setRewardsLoading(false); }
                    }}
                  >
                    {rewardsLoading ? 'Processing…' : 'Confirm & Grant'}
                  </button>
                  <button
                    className="btn-outline"
                    style={{ fontSize: 13, padding: '6px 16px' }}
                    onClick={() => setRewardsConfirming(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {rewardsResult && (
              <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: rewardsResult.startsWith('Rewards') ? '#22c55e' : '#dc2626' }}>
                {rewardsResult}
              </p>
            )}
          </div>
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
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {!u.is_admin && (
                            <button
                              className="btn-outline"
                              style={{ fontSize: 12, padding: '4px 10px', borderColor: u.is_active ? '#dc2626' : 'green', color: u.is_active ? '#dc2626' : 'green' }}
                              onClick={() => toggleActive(u.id)}
                            >
                              {u.is_active ? 'Disable' : 'Enable'}
                            </button>
                          )}
                          <button
                            className="btn-outline"
                            style={{ fontSize: 12, padding: '4px 10px', borderColor: '#f59e0b', color: '#f59e0b' }}
                            onClick={() => {
                              if (adjustingUser === u.id) { setAdjustingUser(null); }
                              else { setAdjustingUser(u.id); setAdjustAmount(''); setAdjustNote(''); }
                            }}
                          >
                            💰 Adjust
                          </button>
                          <button
                            className="btn-outline"
                            style={{ fontSize: 12, padding: '4px 10px', borderColor: '#60a5fa', color: '#60a5fa' }}
                            onClick={() => {
                              if (editingReferrals === u.id) { setEditingReferrals(null); }
                              else { setEditingReferrals(u.id); setReferralInput(''); }
                            }}
                          >
                            👥 Referrals
                          </button>
                        </div>
                        {editingReferrals === u.id && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              placeholder="Set total referral count"
                              value={referralInput}
                              onChange={e => setReferralInput(e.target.value)}
                              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #60a5fa', fontSize: 12, width: '100%' }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn-primary"
                                style={{ fontSize: 12, padding: '4px 10px', flex: 1 }}
                                disabled={referralLoading || referralInput === ''}
                                onClick={async () => {
                                  const count = parseInt(referralInput, 10);
                                  if (isNaN(count) || count < 0) { showToast('Enter a valid number.'); return; }
                                  setReferralLoading(true);
                                  try {
                                    await api.post(`/admin/users/${u.id}/referrals`, { count });
                                    showToast(`Referral count set to ${count}`);
                                    setEditingReferrals(null);
                                  } catch (err: unknown) {
                                    showToast((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed.');
                                  } finally { setReferralLoading(false); }
                                }}
                              >
                                {referralLoading ? 'Saving…' : 'Set'}
                              </button>
                              <button
                                className="btn-outline"
                                style={{ fontSize: 12, padding: '4px 10px' }}
                                onClick={() => setEditingReferrals(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {adjustingUser === u.id && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                            <input
                              type="number"
                              placeholder="Amount (+ credit / - debit)"
                              value={adjustAmount}
                              onChange={e => setAdjustAmount(e.target.value)}
                              step="0.01"
                              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, width: '100%' }}
                            />
                            <input
                              type="text"
                              placeholder="Note (required)"
                              value={adjustNote}
                              onChange={e => setAdjustNote(e.target.value)}
                              maxLength={200}
                              required
                              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, width: '100%' }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn-primary"
                                style={{ fontSize: 12, padding: '4px 10px', flex: 1 }}
                                disabled={adjustLoading}
                                onClick={() => adjustBalance(u.id)}
                              >
                                {adjustLoading ? 'Saving…' : 'Apply'}
                              </button>
                              <button
                                className="btn-outline"
                                style={{ fontSize: 12, padding: '4px 10px' }}
                                onClick={() => setAdjustingUser(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
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

      {/* ── Withdrawals (All) & Pending Withdrawals ── */}
      {(tab === 'withdrawals' || tab === 'pending-withdrawals') && (
        <div>
          {tab === 'withdrawals' ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 13 }}>Filter by status:</label>
              <select
                value={wFilter}
                onChange={e => { setWFilter(e.target.value); setWPage(1); setSelectedW(new Set()); }}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          ) : (
            <div style={{
              marginBottom: '1rem', padding: '10px 14px', borderRadius: 8,
              background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b',
              fontSize: 13, fontWeight: 600, color: '#f59e0b',
            }}>
              ⏳ Showing pending withdrawals only.
              {stats?.pending_withdrawals !== undefined && (
                <span style={{ fontWeight: 400, marginLeft: 6 }}>
                  Total pending: {stats.pending_withdrawals}
                </span>
              )}
            </div>
          )}

          {/* Bulk approve action bar */}
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            marginBottom: '0.5rem', padding: '10px 14px',
            background: selectedRows.length > 0 ? 'rgba(34,197,94,0.08)' : '#f9fafb',
            border: `1px solid ${selectedRows.length > 0 ? '#22c55e' : '#e5e7eb'}`,
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {selectedRows.length > 0
                ? `${selectedRows.length} selected · ₱${selectedTotal.toFixed(2)} total`
                : 'Select pending/processing withdrawals to approve in bulk (max 100). User emails are throttled at 5s each.'}
            </span>
            <span style={{ flex: 1 }} />
            <button
              className="btn-outline"
              disabled={selectableApprovable.length === 0 || batchBusy}
              onClick={toggleSelectAllVisible}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              {selectableApprovable.length > 0 && selectableApprovable.every(w => selectedW.has(w.id))
                ? 'Deselect all visible'
                : 'Select all approvable'}
            </button>
            <button
              className="btn-primary"
              disabled={selectedRows.length === 0 || batchBusy}
              onClick={triggerBulkApprove}
              style={{ fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap', background: '#16a34a', borderColor: '#16a34a' }}
            >
              {batchBusy ? 'Approving…' : `✓ Approve Selected (${selectedRows.length})`}
            </button>
          </div>

          {/* Optional message to include in the approval email */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
              Optional message to include in the approval email ({approveMessage.length}/1000)
            </label>
            <textarea
              value={approveMessage}
              onChange={e => setApproveMessage(e.target.value.slice(0, 1000))}
              placeholder="e.g. Your GCash transfer has been completed. Reference: ABC123."
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
              disabled={batchBusy}
            />
          </div>
          {wLoading ? <p>Loading...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>
                      <input
                        type="checkbox"
                        disabled={selectableApprovable.length === 0}
                        checked={selectableApprovable.length > 0 && selectableApprovable.every(w => selectedW.has(w.id))}
                        onChange={toggleSelectAllVisible}
                        aria-label="Select all approvable withdrawals"
                      />
                    </th>
                    {['ID', 'User', 'Amount', 'Net', 'Channel', 'Account', 'Status', 'Requested At', 'Daily Success', 'Update Status'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map(w => {
                    const selectable = w.status === 'pending' || w.status === 'processing';
                    return (
                    <tr key={w.id} style={{ borderBottom: '1px solid #f3f4f6', background: selectedW.has(w.id) ? 'rgba(34,197,94,0.06)' : undefined }}>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="checkbox"
                          disabled={!selectable}
                          checked={selectedW.has(w.id)}
                          onChange={() => toggleSelectW(w.id)}
                          aria-label={`Select withdrawal ${w.id}`}
                        />
                      </td>
                      <td style={{ padding: '8px 10px' }}>{w.id}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div>{w.user_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{w.user_email}</div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>₱{fmt(w.amount)}</td>
                      <td style={{ padding: '8px 10px' }}>₱{fmt(w.net_amount)}</td>
                      <td style={{ padding: '8px 10px' }}>{w.channel.toUpperCase()}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600, letterSpacing: '0.5px' }}>{fmtPhone(w.account_number)}</div>
                        {w.account_name && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{w.account_name}</div>}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ color: STATUS_COLORS[w.status] ?? '#374151', fontWeight: 600 }}>
                          {w.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        <div>{new Date(w.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>
                          {new Date(w.created_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          minWidth: 28,
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontWeight: 700,
                          fontSize: 13,
                          textAlign: 'center',
                          backgroundColor: w.daily_completed_count === 0 ? '#1f2937' : w.daily_completed_count >= 3 ? '#7f1d1d' : '#14532d',
                          color: w.daily_completed_count === 0 ? '#d1d5db' : w.daily_completed_count >= 3 ? '#fca5a5' : '#86efac',
                          border: `1px solid ${w.daily_completed_count === 0 ? '#374151' : w.daily_completed_count >= 3 ? '#991b1b' : '#166534'}`,
                        }}>
                          {w.daily_completed_count}
                        </span>
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
                    );
                  })}
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

          {/* Bulk Import */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              className="btn-outline"
              style={{ fontSize: 13, padding: '6px 14px', borderColor: '#f59e0b', color: '#f59e0b' }}
              onClick={() => { setBulkImportOpen(o => !o); setBulkResult(null); }}
            >
              {bulkImportOpen ? 'Close Bulk Import' : '📋 Bulk Import Tasks'}
            </button>
            {bulkImportOpen && (
              <div className="card" style={{ marginTop: '0.75rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Bulk Import Tasks</h4>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: '0.5rem' }}>
                  Paste a JSON array of task objects:<br />
                  <code style={{ fontSize: 11 }}>{`[{"title":"...","category":"survey","payout":50,"description":"..."}]`}</code>
                </p>
                <textarea
                  value={bulkJson}
                  onChange={e => setBulkJson(e.target.value)}
                  placeholder='[{"title":"Task 1","category":"survey","payout":50,"description":"..."}]'
                  rows={6}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }}
                />
                {bulkResult && (
                  <p style={{ fontSize: 13, marginTop: 8, fontWeight: 600, color: bulkResult.startsWith('Imported') ? '#22c55e' : '#dc2626' }}>
                    {bulkResult}
                  </p>
                )}
                <button
                  className="btn-primary"
                  style={{ marginTop: 10, fontSize: 13 }}
                  disabled={bulkLoading}
                  onClick={async () => {
                    setBulkLoading(true); setBulkResult(null);
                    try {
                      const parsed = JSON.parse(bulkJson);
                      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array.');
                      const res = await api.post<{ imported: number; skipped: number }>('/admin/tasks/bulk', parsed);
                      setBulkResult(`Imported ${res.data.imported} tasks, skipped ${res.data.skipped}`);
                      setBulkJson('');
                      loadTasks();
                    } catch (err: unknown) {
                      const apiErr = err as { response?: { data?: { message?: string } }; message?: string };
                      setBulkResult(apiErr.response?.data?.message ?? apiErr.message ?? 'Import failed.');
                    } finally { setBulkLoading(false); }
                  }}
                >
                  {bulkLoading ? 'Importing…' : 'Import'}
                </button>
              </div>
            )}
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

      {/* ── Revenue ── */}
      {tab === 'revenue' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Revenue Dashboard</h3>
            <button className="btn-outline" style={{ fontSize: 13 }} onClick={loadRevenue} disabled={revenueLoading}>
              {revenueLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>
          {!revenueStats ? (
            <p>{revenueLoading ? 'Loading...' : 'No data yet.'}</p>
          ) : (
            <>
              <h4 style={{ marginBottom: '0.75rem', color: '#9ca3af', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plan Breakdown</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {(Object.entries(revenueStats.plan_counts) as [PlanValue, number][]).map(([plan, count]) => (
                  <div key={plan} className="card" style={{ textAlign: 'center', borderTop: `3px solid ${PLAN_COLORS[plan]}` }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: PLAN_COLORS[plan] }}>{count}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, textTransform: 'capitalize', fontWeight: 600 }}>{plan} Users</div>
                  </div>
                ))}
              </div>
              <h4 style={{ marginBottom: '0.75rem', color: '#9ca3af', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financial Summary</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Active Subscribers', value: revenueStats.active_subscribers, color: '#60a5fa' },
                  { label: 'Total Paid Out', value: `₱${fmt(revenueStats.total_paid_out)}`, color: '#f59e0b' },
                  { label: 'Earnings Distributed', value: `₱${fmt(revenueStats.total_earnings_distributed)}`, color: '#22c55e' },
                  { label: 'New Users (30d)', value: revenueStats.new_users_30d, color: '#a78bfa' },
                ].map(s => (
                  <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Broadcast ── */}
      {tab === 'broadcast' && (
        <div style={{ maxWidth: 640 }}>
          <h3 style={{ marginBottom: '1rem' }}>Broadcast Email</h3>
          <div className="card">
            <form onSubmit={sendBroadcast}>
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Target Audience</label>
                <select
                  value={broadcastTarget}
                  onChange={e => setBroadcastTarget(e.target.value as 'all' | 'verified' | 'paid')}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)', width: '100%', fontSize: 14 }}
                >
                  <option value="all">All Users</option>
                  <option value="verified">Verified Only</option>
                  <option value="paid">Paid Plans Only</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Subject <span style={{ color: '#9ca3af', fontWeight: 400 }}>({broadcastSubject.length}/200)</span>
                </label>
                <input
                  type="text"
                  value={broadcastSubject}
                  onChange={e => setBroadcastSubject(e.target.value)}
                  placeholder="Email subject line…"
                  maxLength={200}
                  required
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)', width: '100%', fontSize: 14 }}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Message <span style={{ color: '#9ca3af', fontWeight: 400 }}>({broadcastMessage.length}/2000)</span>
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  placeholder="Write your message here…"
                  maxLength={2000}
                  required
                  rows={8}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)', width: '100%', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              {broadcastResult && (
                <p style={{ fontSize: 14, color: broadcastResult.startsWith('Done') ? '#22c55e' : '#dc2626', marginBottom: '0.75rem', fontWeight: 600 }}>
                  {broadcastResult}
                </p>
              )}
              <button className="btn-primary" type="submit" disabled={broadcastLoading} style={{ width: '100%' }}>
                {broadcastLoading ? 'Sending…' : 'Send Broadcast'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── KYC ── */}
      {tab === 'kyc' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
            {(['pending', 'approved', 'rejected'] as const).map(s => (
              <button key={s} onClick={() => setKycFilter(s)} style={{
                padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: kycFilter === s ? 700 : 400,
                background: kycFilter === s ? 'var(--gold)' : 'transparent',
                color: kycFilter === s ? '#000' : 'inherit',
                border: '1px solid var(--gold)',
              }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
          </div>

          {kycLoading && <p>Loading…</p>}
          {!kycLoading && kycList.length === 0 && <p style={{ color: '#6b7280' }}>No {kycFilter} submissions.</p>}

          {kycList.map(sub => {
            const rawTags = sub.tags;
            const tags: string[] = Array.isArray(rawTags) ? rawTags : (typeof rawTags === 'string' ? JSON.parse(rawTags || '[]') : []);
            return (
              <div key={sub.id} className="card" style={{ marginBottom: '1rem', fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{sub.full_name}</div>
                    <div style={{ color: '#9ca3af', fontSize: 12 }}>{sub.user_email} · User #{sub.user_id}</div>
                    <div style={{ marginTop: 4, color: '#9ca3af', fontSize: 12 }}>
                      {sub.id_type.replace(/_/g, ' ')} · {sub.id_number}
                    </div>
                    <div style={{ marginTop: 2, color: '#9ca3af', fontSize: 12 }}>
                      DOB: {sub.date_of_birth} · {sub.nationality}
                    </div>
                    <div style={{ marginTop: 2, color: '#9ca3af', fontSize: 12 }}>
                      {sub.address}, {sub.city}, {sub.province}
                    </div>
                    {tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {tags.map(tag => (
                          <span key={tag} style={{
                            background: tag === 'duplicate_id' ? '#dc2626' : '#d97706',
                            color: '#fff', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                          }}>{tag.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                    {sub.rejection_reason && (
                      <div style={{ marginTop: 6, color: '#fca5a5', fontSize: 12 }}>Reason: {sub.rejection_reason}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(sub.created_at).toLocaleDateString()}</span>
                    {sub.status === 'pending' && (
                      <>
                        <button onClick={async () => { await api.post(`/kyc/admin/${sub.id}/approve`, {}); loadKyc(kycFilter); showToast('KYC approved'); }} style={{
                          padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                          background: '#16a34a', border: 'none', color: '#fff', fontWeight: 700,
                        }}>Approve</button>
                        <button onClick={() => { setKycRejectId(sub.id); setKycRejectReason(''); }} style={{
                          padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                          background: '#dc2626', border: 'none', color: '#fff', fontWeight: 700,
                        }}>Reject</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Reject modal inline */}
                {kycRejectId === sub.id && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(220,38,38,0.08)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.2)' }}>
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: 13 }}>Rejection reason:</p>
                    <textarea value={kycRejectReason} onChange={e => setKycRejectReason(e.target.value)}
                      rows={3} style={{ width: '100%', borderRadius: 6, padding: '6px 10px', background: 'var(--dark-bg)', border: '1px solid var(--dark-border)', color: 'var(--text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      placeholder="Enter rejection reason…" />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={async () => {
                        if (!kycRejectReason.trim()) { showToast('Reason required'); return; }
                        await api.post(`/kyc/admin/${sub.id}/reject`, { reason: kycRejectReason.trim() });
                        setKycRejectId(null); loadKyc(kycFilter); showToast('KYC rejected');
                      }} style={{ padding: '5px 14px', borderRadius: 6, background: '#dc2626', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Confirm Reject</button>
                      <button onClick={() => setKycRejectId(null)} style={{ padding: '5px 14px', borderRadius: 6, background: 'transparent', border: '1px solid #374151', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Document previews — always visible */}
                {(sub.id_front_data || sub.id_back_data || sub.selfie_data) && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'ID Front', data: sub.id_front_data },
                      { label: 'ID Back', data: sub.id_back_data },
                      { label: 'Selfie', data: sub.selfie_data },
                    ].map(({ label, data }) => (
                      <div key={label} style={{ flex: '1 1 180px', minWidth: 160 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
                        {data
                          ? <img src={data} alt={label} style={{ width: '100%', borderRadius: 8, border: '1px solid #374151', objectFit: 'cover', maxHeight: 200 }} />
                          : <div style={{ height: 100, borderRadius: 8, border: '1px dashed #374151', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12 }}>Not uploaded</div>
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'online' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>
                🟢 Online Users
                <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>
                  active in the last 5 minutes · auto-refreshes every 30s
                </span>
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#22c55e', fontWeight: 700 }}>
                {onlineCount !== null ? `${onlineCount} user${onlineCount !== 1 ? 's' : ''} online` : 'Loading…'}
              </p>
            </div>
            <button
              onClick={loadOnline}
              disabled={onlineLoading}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontSize: 13 }}
            >
              {onlineLoading ? 'Refreshing…' : '↻ Refresh'}
            </button>
          </div>

          {onlineLoading && onlineUsers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</p>
          ) : onlineUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: 36, margin: '0 0 0.5rem' }}>😴</p>
              <p style={{ fontSize: 15, fontWeight: 600 }}>No users online right now</p>
              <p style={{ fontSize: 13 }}>Users become visible once they make an API request.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>User</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Plan</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {onlineUsers.map(u => {
                  const secsAgo = Math.floor((Date.now() - new Date(u.last_active_at).getTime()) / 1000);
                  const ago = secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', marginRight: 8 }} />
                        {u.name}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{u.email}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ textTransform: 'capitalize', fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--surface)' }}>
                          {u.plan}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#22c55e', fontWeight: 600 }}>{ago}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── GCash Payments ── */}
      {tab === 'gcash-payments' && (
        <div>
          {/* Screenshot lightbox */}
          {gcashPreview && (
            <div
              onClick={() => setGcashPreview(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
            >
              <img src={gcashPreview} alt="Receipt" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center' }}>
            {(['pending', 'approved', 'rejected'] as const).map(s => (
              <button key={s} onClick={() => setGcashFilter(s)} style={{
                padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: gcashFilter === s ? 700 : 400,
                background: gcashFilter === s ? 'var(--gold)' : 'transparent',
                color: gcashFilter === s ? '#000' : 'inherit',
                border: '1px solid var(--gold)', textTransform: 'capitalize',
              }}>{s}</button>
            ))}
            <button onClick={() => loadGcashPayments(gcashFilter)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>
              {gcashLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {gcashLoading && gcashPayments.length === 0 ? <p>Loading…</p> : gcashPayments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>No {gcashFilter} payments.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Submitted', 'User', 'Plan', 'Amount', 'Reference #', 'Receipt', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gcashPayments.map(g => (
                  <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <div>{new Date(g.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(g.created_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600 }}>{g.user_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{g.user_email}</div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 700, color: g.plan === 'diamond' ? '#60a5fa' : g.plan === 'gold' ? '#f59e0b' : '#9ca3af' }}>
                        {g.plan}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#22c55e' }}>₱{g.amount}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}>{g.reference}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {g.screenshot_url ? (
                        <img
                          src={g.screenshot_url}
                          alt="receipt"
                          onClick={() => setGcashPreview(g.screenshot_url)}
                          style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in', border: '1px solid var(--border)' }}
                        />
                      ) : <span style={{ color: '#6b7280', fontSize: 11 }}>None</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, textTransform: 'capitalize',
                        background: g.status === 'approved' ? 'rgba(34,197,94,0.15)' : g.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                        color: g.status === 'approved' ? '#22c55e' : g.status === 'rejected' ? '#ef4444' : '#eab308',
                      }}>{g.status}</span>
                      {g.admin_note && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{g.admin_note}</div>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {g.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Approve ${g.plan} plan for ${g.user_name}? This will activate their plan.`)) return;
                              await api.patch(`/admin/gcash-payments/${g.id}/approve`, {});
                              showToast('Plan activated!');
                              loadGcashPayments(gcashFilter);
                            }}
                            style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                          >Approve</button>
                          <button
                            onClick={async () => {
                              const note = window.prompt('Rejection reason (optional):') ?? '';
                              if (note === null) return;
                              await api.patch(`/admin/gcash-payments/${g.id}/reject`, { note });
                              showToast('Payment rejected.');
                              loadGcashPayments(gcashFilter);
                            }}
                            style={{ padding: '4px 10px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                          >Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
