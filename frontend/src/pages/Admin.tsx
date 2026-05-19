import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { WithdrawalStatus, WithdrawalChannel } from '../types';

type Tab = 'stats' | 'users' | 'withdrawals' | 'pending-withdrawals' | 'tasks' | 'logs' | 'revenue' | 'broadcast' | 'kyc' | 'online' | 'gcash-payments' | 'fraud' | 'settings';

const TAB_LABELS: Record<Tab, string> = {
  stats: 'Stats',
  revenue: 'Revenue',
  users: 'Users',
  'pending-withdrawals': 'Pending Withdrawals',
  withdrawals: 'All Withdrawals',
  tasks: 'Tasks',
  kyc: 'KYC',
  fraud: 'Fraud Detection',
  'gcash-payments': 'GCash Payments',
  online: 'Online',
  logs: 'Audit Logs',
  broadcast: 'Broadcast',
  settings: 'Settings',
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
  pending_kyc: number;
  pending_gcash: number;
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
  withdrawal_credits?: number | null;
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
  user_plan?: string;
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
  plan_breakdown: { free: number; silver: number; gold: number; diamond: number };
  active_subscribers: number;
  total_withdrawals_paid: number;
  total_earnings_distributed: number;
  new_users_30d: number;
  subscription_revenue: number;
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
  const [wSearch, setWSearch] = useState('');
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

  // Fraud Detection
  interface FlaggedWithdrawal { id: number; user_id: number; user_name: string; user_email: string; amount: string | number; status: string; created_at: string; metadata: string | null; is_active: boolean; }
  interface DupDevice { fingerprint: string; user1_id: number; user1_name: string; user1_email: string; user1_active: boolean; user1_created_at: string; user2_id: number; user2_name: string; user2_email: string; user2_active: boolean; user2_created_at: string; }
  interface DupIpGroup { ip: string; count: number; users: { id: number; name: string; email: string; is_active: boolean; created_at: string; plan: string }[]; }
  interface FraudReferral { referral_id: number; created_at: string; referrer_id: number; referrer_name: string; referrer_email: string; referred_id: number; referred_name: string; referred_email: string; same_device: boolean; same_ip: boolean; }
  interface FraudReport { flagged_withdrawals: FlaggedWithdrawal[]; duplicate_devices: DupDevice[]; duplicate_ips: DupIpGroup[]; fraud_referrals: FraudReferral[]; }
  const [fraudData, setFraudData] = useState<FraudReport | null>(null);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [suspendingAll, setSuspendingAll] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendCategory, setSuspendCategory] = useState<'all' | 'devices' | 'ips' | 'referrals' | 'flagged'>('all');

  const SUSPEND_REASONS: Record<string, string> = {
    all:       'Multiple accounts or fraudulent activity detected on your device or network.',
    devices:   'Your account was suspended because multiple accounts were found registered from the same device. Each device may only have one Kitazon account.',
    ips:       'Your account was suspended because multiple accounts were registered from the same IP address, which violates our one-account-per-household policy.',
    referrals: 'Your account was suspended due to suspicious referral activity. Self-referrals or referrals made from the same device or network are not permitted.',
    flagged:   'Your account was suspended due to suspicious withdrawal activity flagged by our fraud prevention system.',
  };
  const SUSPEND_LABELS: Record<string, string> = {
    all:       'All Fraud Accounts',
    devices:   'Duplicate Device Accounts',
    ips:       'Shared IP Accounts',
    referrals: 'Suspicious Referral Accounts',
    flagged:   'Flagged Withdrawal Accounts',
  };

  function getCategoryUserIds(category: string): number[] | null {
    if (!fraudData || category === 'all') return null;
    if (category === 'devices') return [...new Set(fraudData.duplicate_devices.flatMap(d => [d.user1_id, d.user2_id]))];
    if (category === 'ips')     return [...new Set(fraudData.duplicate_ips.flatMap(g => g.users.map(u => u.id)))];
    if (category === 'referrals') return [...new Set(fraudData.fraud_referrals.flatMap(r => [r.referrer_id, r.referred_id]))];
    if (category === 'flagged') return [...new Set(fraudData.flagged_withdrawals.map(w => w.user_id))];
    return null;
  }

  function openSuspendModal(category: 'all' | 'devices' | 'ips' | 'referrals' | 'flagged') {
    setSuspendCategory(category);
    setSuspendReason(SUSPEND_REASONS[category]);
    setShowSuspendModal(true);
  }

  // Site Settings
  const SETTINGS_DEFAULTS: Record<string, string> = {
    gcash_number: '',
    gcash_name: 'Kitazon',
    gcash_qr_bronze:  '',
    gcash_qr_silver: 'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935459/4432f02f-79d9-4bf7-bd8f-39f0b63487ad_qbjxzx.jpg',
    gcash_qr_gold: 'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935610/1593c9bc-c490-4854-826d-72ad2a5a79a1_cwdk3l.jpg',
    gcash_qr_diamond: 'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935570/69504c45-6f87-43b1-aebe-83d55a30e5be_p6tncl.jpg',
    credit_php_per_credit: '25',
    withdrawal_min: '5',
    quiz_gate_free: '40',
    quiz_gate_bronze: '40',
    quiz_gate_silver: '20',
    quiz_gate_gold: '0',
    quiz_gate_diamond: '0',
    referral_gate_free: '2',
    referral_gate_bronze: '2',
    referral_gate_silver: '1',
    referral_gate_gold: '0',
    referral_gate_diamond: '0',
    plan_price_bronze: '49',
    plan_price_silver: '499',
    plan_price_gold: '1299',
    plan_price_diamond: '1999',
    plan_limit_free: '5',
    plan_limit_bronze: '5',
    plan_limit_silver: '20',
    plan_limit_gold: '50',
    plan_limit_diamond: '100',
    announcement_text: '',
    announcement_color: '#f59e0b',
    maintenance_mode: 'false',
  };
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>(SETTINGS_DEFAULTS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsResult, setSettingsResult] = useState<string | null>(null);

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

  // Reset pagination, selection, and data when switching withdrawal tabs
  // so stale data from one view never bleeds into the other.
  useEffect(() => {
    if (tab === 'withdrawals' || tab === 'pending-withdrawals') {
      setWPage(1);
      setSelectedW(new Set());
      setWithdrawals([]);
      setWSearch('');
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

  const loadWithdrawals = useCallback(async (page: number, status: string, search = '') => {
    setWLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get<{ withdrawals: AdminWithdrawal[]; pages: number }>(
        `/admin/withdrawals?${params.toString()}`
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

  const loadFraud = useCallback(async () => {
    setFraudLoading(true);
    try {
      const res = await api.get<FraudReport>('/admin/fraud');
      setFraudData(res.data);
    } finally { setFraudLoading(false); }
  }, []);

  const loadSiteSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await api.get<Record<string, string>>('/admin/settings');
      setSiteSettings(prev => ({ ...prev, ...res.data }));
    } catch { /* keep defaults */ } finally { setSettingsLoading(false); }
  }, []);

  const saveSiteSettings = async () => {
    setSettingsSaving(true); setSettingsResult(null);
    try {
      await api.put('/admin/settings', siteSettings);
      setSettingsResult('Settings saved successfully.');
    } catch (err: unknown) {
      setSettingsResult((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to save settings.');
    } finally { setSettingsSaving(false); }
  };

  const setSetting = (key: string, value: string) => {
    setSiteSettings(prev => ({ ...prev, [key]: value }));
  };

  // Load platform stats once on mount so the "Pending Withdrawals (N)"
  // tab badge stays accurate even before the Stats tab has been opened.
  useEffect(() => {
    if (user?.is_admin && !stats) loadStats();
  }, [user, stats, loadStats]);

  useEffect(() => {
    if (tab === 'stats' && !stats) loadStats();
    if (tab === 'users') loadUsers(userPage, userSearch);
    if (tab === 'withdrawals') loadWithdrawals(wPage, wFilter, wSearch);
    if (tab === 'pending-withdrawals') loadWithdrawals(wPage, 'pending', wSearch);
    if (tab === 'tasks') loadTasks();
    if (tab === 'logs') loadLogs(logPage);
    if (tab === 'revenue' && !revenueStats) loadRevenue();
    if (tab === 'kyc') loadKyc(kycFilter);
    if (tab === 'gcash-payments') loadGcashPayments(gcashFilter);
    if (tab === 'online') loadOnline();
    if (tab === 'fraud' && !fraudData) loadFraud();
    if (tab === 'settings') loadSiteSettings();
  }, [tab, userPage, wPage, wFilter, wSearch, logPage, kycFilter, gcashFilter, stats, revenueStats, fraudData, loadStats, loadUsers, loadWithdrawals, loadTasks, loadLogs, loadRevenue, loadKyc, loadGcashPayments, loadOnline, loadFraud, loadSiteSettings]);

  // Auto-refresh online tab every 1 minute
  useEffect(() => {
    if (tab !== 'online') return;
    const interval = setInterval(loadOnline, 60_000);
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
    loadWithdrawals(wPage, tab === 'pending-withdrawals' ? 'pending' : wFilter, wSearch);
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
      loadWithdrawals(wPage, tab === 'pending-withdrawals' ? 'pending' : wFilter, wSearch);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Bulk approve failed.';
      setToast(msg);
      setTimeout(() => setToast(''), 5000);
    } finally {
      setBatchBusy(false);
    }
  };

  const exportWithdrawalsCSV = () => {
    const headers = ['ID', 'Requested At', 'User Name', 'User Email', 'Amount', 'Fee', 'Net Amount', 'Channel', 'Account Number', 'Account Name', 'Status'];
    const rows = withdrawals.map(w => [
      w.id,
      new Date(w.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
      w.user_name,
      w.user_email,
      Number(w.amount).toFixed(2),
      Number(w.fee).toFixed(2),
      Number(w.net_amount).toFixed(2),
      w.channel,
      w.account_number,
      w.account_name ?? '',
      w.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `withdrawals_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const si = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const TABS: { id: Tab; label: string; icon: JSX.Element; badge?: number }[] = [
    { id: 'stats',               label: 'Stats',               icon: <svg {...si}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { id: 'revenue',             label: 'Revenue',             icon: <svg {...si}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    { id: 'users',               label: 'Users',               icon: <svg {...si}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: 'pending-withdrawals', label: 'Pending Withdrawals', icon: <svg {...si}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { id: 'withdrawals',         label: 'All Withdrawals',     icon: <svg {...si}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
    { id: 'tasks',               label: 'Tasks',               icon: <svg {...si}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { id: 'kyc',                 label: 'KYC',                 icon: <svg {...si}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><path d="M9 12h6M9 16h4"/></svg> },
    { id: 'gcash-payments',      label: 'GCash Payments',      icon: <svg {...si}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
    { id: 'online',              label: 'Online',              icon: <svg {...si}><circle cx="12" cy="12" r="3"/><path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10"/></svg> },
    { id: 'logs',                label: 'Audit Logs',          icon: <svg {...si}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
    { id: 'broadcast',           label: 'Broadcast',           icon: <svg {...si}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
    { id: 'fraud',               label: 'Fraud Detection',     icon: <svg {...si}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, badge: (fraudData?.duplicate_devices.length ?? 0) + (fraudData?.fraud_referrals.length ?? 0) + (fraudData?.flagged_withdrawals.filter((w: FlaggedWithdrawal) => w.status === 'pending').length ?? 0) },
    { id: 'settings',            label: 'Settings',            icon: <svg {...si}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'flex-start' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#16a34a', color: '#fff', padding: '10px 18px', borderRadius: 8, zIndex: 9999, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {/* ── Sidebar ── */}
      <div style={{ width: 230, flexShrink: 0, background: 'var(--dark-card)', borderRight: '1px solid var(--dark-border)', minHeight: '100vh', padding: '1.5rem 0.75rem', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '0 0.5rem', marginBottom: '1rem' }}>Admin Panel</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map(t => {
            const isActive = tab === t.id;
            const badge =
              t.id === 'pending-withdrawals' ? (stats?.pending_withdrawals || null) :
              t.id === 'kyc'                 ? (stats?.pending_kyc || null) :
              t.id === 'gcash-payments'      ? (stats?.pending_gcash || null) :
              t.id === 'online'              ? onlineCount :
              t.badge != null && t.badge > 0 ? t.badge :
              null;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.6rem 0.75rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: isActive ? 'var(--gold)' : 'transparent',
                  color: isActive ? '#000' : 'var(--text)',
                  fontWeight: isActive ? 700 : 400, fontSize: '0.84rem',
                  textAlign: 'left', width: '100%', transition: 'background 0.15s',
                }}
              >
                <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65 }}>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                {badge !== null && badge > 0 && (
                  <span style={{ background: isActive ? 'rgba(0,0,0,0.25)' : '#ef4444', color: '#fff', fontSize: '0.68rem', fontWeight: 800, borderRadius: 999, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, padding: '2rem 1.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>{TAB_LABELS[tab]}</h2>

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
                    {['ID', 'Name', 'Email', 'Balance', 'Credits', 'Plan', 'Verified', 'Active', 'Joined', 'Actions'].map(h => (
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
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: Number(u.withdrawal_credits ?? 0) > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                        {Number(u.withdrawal_credits ?? 0)} CR
                      </td>
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
              <button
                onClick={exportWithdrawalsCSV}
                disabled={withdrawals.length === 0}
                style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, border: '1px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: withdrawals.length === 0 ? 'default' : 'pointer', opacity: withdrawals.length === 0 ? 0.4 : 1 }}
              >
                ⬇ Export CSV
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8,
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
                <button
                  onClick={exportWithdrawalsCSV}
                  disabled={withdrawals.length === 0}
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: withdrawals.length === 0 ? 'default' : 'pointer', opacity: withdrawals.length === 0 ? 0.4 : 1, whiteSpace: 'nowrap' }}
                >
                  ⬇ Export CSV
                </button>
              </div>
              {/* Search bar */}
              <div style={{ position: 'relative', maxWidth: 360 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  placeholder="Search by name, email, or account…"
                  value={wSearch}
                  onChange={e => { setWSearch(e.target.value); setWPage(1); }}
                  style={{ width: '100%', paddingLeft: 32, paddingRight: wSearch ? 32 : 10, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: '1px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
                {wSearch && (
                  <button onClick={() => { setWSearch(''); setWPage(1); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                )}
              </div>
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
          {wLoading ? <p>Loading...</p> : (() => {
            const PAID_PLANS = ['bronze', 'silver', 'gold', 'diamond'];
            const PLAN_COLOR: Record<string, string> = { bronze: '#cd7f32', silver: '#9ca3af', gold: '#f59e0b', diamond: '#60a5fa' };
            const PLAN_BADGE: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎' };

            const paidWithdrawals = tab === 'pending-withdrawals'
              ? withdrawals.filter(w => w.user_plan && PAID_PLANS.includes(w.user_plan))
              : withdrawals;
            const freeWithdrawals = tab === 'pending-withdrawals'
              ? withdrawals.filter(w => !w.user_plan || !PAID_PLANS.includes(w.user_plan))
              : [];

            const renderTable = (rows: AdminWithdrawal[], headerBg?: string) => (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: headerBg ?? '#f9fafb' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>
                      <input
                        type="checkbox"
                        disabled={selectableApprovable.length === 0}
                        checked={selectableApprovable.length > 0 && selectableApprovable.every(w => selectedW.has(w.id))}
                        onChange={toggleSelectAllVisible}
                        aria-label="Select all approvable withdrawals"
                      />
                    </th>
                    {['ID', 'User', 'Plan', 'Amount', 'Net', 'Channel', 'Account', 'Status', 'Requested At', 'Daily Success', 'Update Status'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={12} style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No withdrawals in this group.</td></tr>
                  ) : rows.map(w => {
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
                      <td style={{ padding: '8px 10px' }}>
                        {w.user_plan && PAID_PLANS.includes(w.user_plan)
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${PLAN_COLOR[w.user_plan]}22`, color: PLAN_COLOR[w.user_plan], whiteSpace: 'nowrap' }}>{PLAN_BADGE[w.user_plan]} {w.user_plan.charAt(0).toUpperCase() + w.user_plan.slice(1)}</span>
                          : <span style={{ fontSize: 11, color: '#9ca3af' }}>Free</span>
                        }
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
            );

            if (tab === 'pending-withdrawals') {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Paid plan users — priority */}
                  <div style={{ border: '1.5px solid rgba(245,158,11,0.4)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1rem' }}>⭐</span>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#f59e0b' }}>Priority — Paid Plan Users</span>
                      <span style={{ marginLeft: 'auto', background: '#f59e0b', color: '#fff', borderRadius: 20, padding: '1px 10px', fontSize: 12, fontWeight: 700 }}>{paidWithdrawals.length}</span>
                    </div>
                    {renderTable(paidWithdrawals, 'rgba(245,158,11,0.05)')}
                  </div>
                  {/* Free plan users */}
                  <div style={{ border: '1px solid var(--dark-border)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: 'rgba(107,114,128,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1rem' }}>🆓</span>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#9ca3af' }}>Free Plan Users</span>
                      <span style={{ marginLeft: 'auto', background: '#6b7280', color: '#fff', borderRadius: 20, padding: '1px 10px', fontSize: 12, fontWeight: 700 }}>{freeWithdrawals.length}</span>
                    </div>
                    {renderTable(freeWithdrawals)}
                  </div>
                </div>
              );
            }
            return renderTable(withdrawals);
          })()}
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
                {(Object.entries(revenueStats.plan_breakdown) as [PlanValue, number][]).map(([plan, count]) => (
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
                  { label: 'Subscription Revenue', value: `₱${fmt(revenueStats.subscription_revenue)}`, color: '#f59e0b' },
                  { label: 'Total Paid Out', value: `₱${fmt(revenueStats.total_withdrawals_paid)}`, color: '#f97316' },
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
      {/* ── Fraud Detection ── */}
      {tab === 'fraud' && (
        <div style={{ maxWidth: 980 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Fraud Detection</h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Suspicious accounts, duplicate devices, and flagged activity</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={loadFraud} disabled={fraudLoading} style={{ padding: '7px 16px', borderRadius: 10, border: '1.5px solid var(--dark-border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={fraudLoading ? { animation: 'spin 1s linear infinite' } : {}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Refresh
              </button>
              <button
                disabled={suspendingAll || fraudLoading}
                onClick={() => openSuspendModal('all')}
                style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, opacity: suspendingAll ? 0.7 : 1 }}
              >
                {suspendingAll
                  ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Suspending…</>
                  : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Suspend All</>
                }
              </button>

              {/* Suspend Modal (shared for global + per-category) */}
              {showSuspendModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}
                  onClick={e => { if (e.target === e.currentTarget) setShowSuspendModal(false); }}
                >
                  <div style={{ background: 'var(--dark-card)', border: '1.5px solid #ef4444', borderRadius: 18, padding: '2rem', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ef4444' }}>Suspend: {SUSPEND_LABELS[suspendCategory]}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.87rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {suspendCategory === 'all'
                        ? 'Deactivates all accounts flagged across duplicate devices, shared IPs, and fraud referrals.'
                        : `Deactivates only the accounts in the "${SUSPEND_LABELS[suspendCategory]}" category.`}
                      {' '}Each affected user receives an email with the reason below.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                        Suspension Reason <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(sent in the email — editable)</span>
                      </label>
                      <textarea
                        rows={4}
                        value={suspendReason}
                        onChange={e => setSuspendReason(e.target.value)}
                        style={{ resize: 'vertical', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', minHeight: 88 }}
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Object.entries(SUSPEND_REASONS).map(([cat, text]) => (
                          <button key={cat} onClick={() => setSuspendReason(text)}
                            style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid var(--dark-border)', background: suspendReason === text ? 'rgba(239,68,68,0.15)' : 'transparent', color: suspendReason === text ? '#ef4444' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                            {SUSPEND_LABELS[cat]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button onClick={() => setShowSuspendModal(false)} style={{ padding: '8px 18px', borderRadius: 10, border: '1.5px solid var(--dark-border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                      <button
                        disabled={suspendingAll}
                        onClick={async () => {
                          setShowSuspendModal(false);
                          setSuspendingAll(true);
                          try {
                            const reason = suspendReason.trim() || SUSPEND_REASONS[suspendCategory];
                            const userIds = getCategoryUserIds(suspendCategory);
                            const payload: { reason: string; user_ids?: number[] } = { reason };
                            if (userIds) payload.user_ids = userIds;
                            const res = await api.post<{ suspended: number }>('/admin/fraud/suspend-all', payload);
                            if (res.data.suspended === 0) {
                              showToast('No active accounts found to suspend in this category.');
                            } else {
                              showToast(`${res.data.suspended} account${res.data.suspended !== 1 ? 's' : ''} suspended. Email notifications sent.`);
                            }
                            await loadFraud();
                          } catch (err: unknown) {
                            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to suspend accounts.';
                            console.error('[Suspend All] error:', err);
                            showToast(msg);
                          } finally { setSuspendingAll(false); }
                        }}
                        style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, opacity: suspendingAll ? 0.7 : 1 }}
                      >
                        {suspendingAll ? 'Suspending…' : 'Confirm Suspend'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {fraudLoading ? (
            <div style={{ color: 'var(--text-muted)', padding: '2rem 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Scanning for fraud signals…
            </div>
          ) : fraudData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Flagged Withdrawals */}
              <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Flagged Withdrawals</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Withdrawals marked suspicious by the fraud engine</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{fraudData.flagged_withdrawals.length}</span>
                    {fraudData.flagged_withdrawals.length > 0 && (
                      <button onClick={() => openSuspendModal('flagged')} disabled={suspendingAll}
                        style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', opacity: suspendingAll ? 0.6 : 1 }}>
                        Suspend All
                      </button>
                    )}
                  </div>
                </div>
                {fraudData.flagged_withdrawals.length === 0 ? (
                  <p style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No flagged withdrawals.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead><tr style={{ borderBottom: '1px solid var(--dark-border)' }}>
                        {['ID','User','Amount','Status','Flags','Date'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {fraudData.flagged_withdrawals.map(w => {
                          let flags: string[] = [];
                          try { const m = typeof w.metadata === 'string' ? JSON.parse(w.metadata) : w.metadata; flags = m?.flags ?? []; } catch {}
                          return (
                            <tr key={w.id} style={{ borderBottom: '1px solid var(--dark-border)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>#{w.id}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ fontWeight: 600 }}>{w.user_name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.user_email}</div>
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 700 }}>₱{Number(w.amount).toFixed(2)}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: w.status === 'pending' ? 'rgba(217,119,6,0.15)' : w.status === 'completed' ? 'rgba(22,163,74,0.15)' : 'rgba(107,114,128,0.15)', color: w.status === 'pending' ? '#d97706' : w.status === 'completed' ? '#16a34a' : 'var(--text-muted)' }}>{w.status}</span>
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {flags.map((f: string) => <span key={f} style={{ padding: '2px 7px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{f.replace(/_/g, ' ')}</span>)}
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(w.created_at).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Duplicate Devices */}
              <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Duplicate Device Registrations</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Multiple accounts sharing the same browser fingerprint</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{fraudData.duplicate_devices.length}</span>
                    {fraudData.duplicate_devices.length > 0 && (
                      <button onClick={() => openSuspendModal('devices')} disabled={suspendingAll}
                        style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', opacity: suspendingAll ? 0.6 : 1 }}>
                        Suspend All
                      </button>
                    )}
                  </div>
                </div>
                {fraudData.duplicate_devices.length === 0 ? (
                  <p style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No duplicate device fingerprints found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {fraudData.duplicate_devices.map((d, i) => (
                      <div key={i} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[{ id: d.user1_id, name: d.user1_name, email: d.user1_email, active: d.user1_active, created_at: d.user1_created_at }, { id: d.user2_id, name: d.user2_name, email: d.user2_email, active: d.user2_active, created_at: d.user2_created_at }].map((u, j) => (
                          <div key={j} style={{ background: 'var(--dark-bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--dark-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{u.name}</span>
                              <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: u.active ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)', color: u.active ? '#16a34a' : '#ef4444' }}>{u.active ? 'Active' : 'Banned'}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Joined {new Date(u.created_at).toLocaleDateString()}</div>
                            <button onClick={() => toggleActive(u.id)} style={{ marginTop: 8, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--dark-border)', background: 'transparent', color: u.active ? '#ef4444' : '#16a34a', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                              {u.active ? 'Ban Account' : 'Unban Account'}
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Duplicate IPs */}
              <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Shared Registration IPs</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>IPs used to register 3 or more accounts</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: '#60a5fa', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{fraudData.duplicate_ips.length}</span>
                    {fraudData.duplicate_ips.length > 0 && (
                      <button onClick={() => openSuspendModal('ips')} disabled={suspendingAll}
                        style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#60a5fa', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', opacity: suspendingAll ? 0.6 : 1 }}>
                        Suspend All
                      </button>
                    )}
                  </div>
                </div>
                {fraudData.duplicate_ips.length === 0 ? (
                  <p style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No suspicious IPs found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {fraudData.duplicate_ips.map((group, i) => (
                      <div key={i} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <code style={{ background: 'var(--dark-bg)', padding: '3px 8px', borderRadius: 6, fontSize: '0.8rem', border: '1px solid var(--dark-border)' }}>{group.ip}</code>
                          <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 700 }}>{group.count} accounts</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {group.users.map(u => (
                            <div key={u.id} style={{ background: 'var(--dark-bg)', borderRadius: 10, padding: '8px 12px', border: '1px solid var(--dark-border)', minWidth: 180 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{u.name}</span>
                                <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: u.is_active ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)', color: u.is_active ? '#16a34a' : '#ef4444' }}>{u.is_active ? 'Active' : 'Banned'}</span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.email}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{u.plan} · {new Date(u.created_at).toLocaleDateString()}</div>
                              <button onClick={() => toggleActive(u.id)} style={{ marginTop: 6, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--dark-border)', background: 'transparent', color: u.is_active ? '#ef4444' : '#16a34a', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>
                                {u.is_active ? 'Ban' : 'Unban'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fraud Referrals */}
              <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Suspicious Referrals</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Referrer and referred share same device or IP address</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: '#a855f7', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{fraudData.fraud_referrals.length}</span>
                    {fraudData.fraud_referrals.length > 0 && (
                      <button onClick={() => openSuspendModal('referrals')} disabled={suspendingAll}
                        style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#a855f7', color: '#fff', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', opacity: suspendingAll ? 0.6 : 1 }}>
                        Suspend All
                      </button>
                    )}
                  </div>
                </div>
                {fraudData.fraud_referrals.length === 0 ? (
                  <p style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No suspicious referrals found.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead><tr style={{ borderBottom: '1px solid var(--dark-border)' }}>
                        {['Referrer','Referred','Signal','Date'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {fraudData.fraud_referrals.map(r => (
                          <tr key={r.referral_id} style={{ borderBottom: '1px solid var(--dark-border)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: 600 }}>{r.referrer_name}</div>
                              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{r.referrer_email}</div>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: 600 }}>{r.referred_name}</div>
                              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{r.referred_email}</div>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {r.same_device && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Same Device</span>}
                                {r.same_ip && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Same IP</span>}
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
      {/* ── Settings ── */}
      {tab === 'settings' && (
        <div style={{ maxWidth: 860 }}>
          {settingsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', padding: '2rem 0' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Loading settings…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* ── GCash Config ── */}
              <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,115,230,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>GCash Configuration</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Payment account & QR codes shown to users</p>
                  </div>
                </div>
                <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { key: 'gcash_number', label: 'GCash Number', placeholder: '09XXXXXXXXX', full: false },
                    { key: 'gcash_name',   label: 'Account Name', placeholder: 'Kitazon', full: false },
                    { key: 'gcash_qr_bronze',  label: 'Bronze Plan QR URL',  placeholder: 'https://...', full: true },
                    { key: 'gcash_qr_silver',  label: 'Silver Plan QR URL',  placeholder: 'https://...', full: true },
                    { key: 'gcash_qr_gold',    label: 'Gold Plan QR URL',    placeholder: 'https://...', full: true },
                    { key: 'gcash_qr_diamond', label: 'Diamond Plan QR URL', placeholder: 'https://...', full: true },
                  ].map(({ key, label, placeholder, full }) => (
                    <div key={key} style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                      <input type="text" value={siteSettings[key] ?? ''} onChange={e => setSetting(key, e.target.value)} placeholder={placeholder}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Plans ── */}
              <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Plan Configuration</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Prices and max withdrawal limits per plan</p>
                  </div>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Plan grid table */}
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Max Withdrawal per Request (₱)</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                      {([
                        { plan: 'free',    color: '#6b7280', label: 'Free' },
                        { plan: 'bronze',  color: '#cd7f32', label: 'Bronze' },
                        { plan: 'silver',  color: '#9ca3af', label: 'Silver' },
                        { plan: 'gold',    color: '#f59e0b', label: 'Gold' },
                        { plan: 'diamond', color: '#60a5fa', label: 'Diamond' },
                      ] as const).map(({ plan, color, label }) => (
                        <div key={plan} style={{ background: 'var(--dark-bg)', borderRadius: 12, padding: '0.75rem', border: `1.5px solid ${color}22` }}>
                          <p style={{ fontSize: '0.7rem', fontWeight: 700, color, marginBottom: 6, textTransform: 'uppercase' }}>{label}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>₱</span>
                            <input type="number" min={1} value={siteSettings[`plan_limit_${plan}`] ?? ''} onChange={e => setSetting(`plan_limit_${plan}`, e.target.value)}
                              style={{ flex: 1, width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid var(--dark-border)', background: 'transparent', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 700, outline: 'none' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Monthly Price (₱/mo) — paid plans only</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {([
                        { plan: 'bronze',  color: '#cd7f32', label: 'Bronze' },
                        { plan: 'silver',  color: '#9ca3af', label: 'Silver' },
                        { plan: 'gold',    color: '#f59e0b', label: 'Gold' },
                        { plan: 'diamond', color: '#60a5fa', label: 'Diamond' },
                      ] as const).map(({ plan, color, label }) => (
                        <div key={plan} style={{ background: 'var(--dark-bg)', borderRadius: 12, padding: '0.75rem', border: `1.5px solid ${color}22` }}>
                          <p style={{ fontSize: '0.7rem', fontWeight: 700, color, marginBottom: 6, textTransform: 'uppercase' }}>{label}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>₱</span>
                            <input type="number" min={0} value={siteSettings[`plan_price_${plan}`] ?? ''} onChange={e => setSetting(`plan_price_${plan}`, e.target.value)}
                              style={{ flex: 1, width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid var(--dark-border)', background: 'transparent', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 700, outline: 'none' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Withdrawal Gates ── */}
              <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Withdrawal Gates</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Requirements users must meet before withdrawing · set 0 to disable</p>
                  </div>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {[
                    { gateKey: 'quiz_gate', label: 'Quiz Gate', desc: 'Correct quiz answers required', icon: '🧠' },
                    { gateKey: 'referral_gate', label: 'Referral Gate', desc: 'Friend invites required', icon: '👥' },
                  ].map(({ gateKey, label, desc, icon }) => (
                    <div key={gateKey}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                        <div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>{label}</p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>{desc}</p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                        {([
                          { plan: 'free',    color: '#6b7280', label: 'Free' },
                          { plan: 'bronze',  color: '#cd7f32', label: 'Bronze' },
                          { plan: 'silver',  color: '#9ca3af', label: 'Silver' },
                          { plan: 'gold',    color: '#f59e0b', label: 'Gold' },
                          { plan: 'diamond', color: '#60a5fa', label: 'Diamond' },
                        ] as const).map(({ plan, color, label: planLabel }) => (
                          <div key={plan} style={{ background: 'var(--dark-bg)', borderRadius: 10, padding: '0.65rem 0.75rem' }}>
                            <p style={{ fontSize: '0.68rem', fontWeight: 700, color, marginBottom: 5, textTransform: 'uppercase' }}>{planLabel}</p>
                            <input type="number" min={0} value={siteSettings[`${gateKey}_${plan}`] ?? ''} onChange={e => setSetting(`${gateKey}_${plan}`, e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid var(--dark-border)', background: 'transparent', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Credits & Withdrawals ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9.5a3.5 3.5 0 1 0-3 5.5"/></svg>
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Credits</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Conversion rate</p>
                    </div>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>₱ per Credit</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--dark-bg)', borderRadius: 10, border: '1.5px solid var(--dark-border)', padding: '8px 12px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#60a5fa' }}>₱</span>
                      <input type="number" min={1} value={siteSettings['credit_php_per_credit'] ?? ''} onChange={e => setSetting('credit_php_per_credit', e.target.value)}
                        style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', fontWeight: 800, outline: 'none' }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>= 1 credit</span>
                    </div>
                  </div>
                </div>
                <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Withdrawals</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Minimum amount</p>
                    </div>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Minimum Amount (₱)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--dark-bg)', borderRadius: 10, border: '1.5px solid var(--dark-border)', padding: '8px 12px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#22c55e' }}>₱</span>
                      <input type="number" min={1} value={siteSettings['withdrawal_min'] ?? ''} onChange={e => setSetting('withdrawal_min', e.target.value)}
                        style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: '1.1rem', fontWeight: 800, outline: 'none' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Site & Announcements ── */}
              <div style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Site & Announcements</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Banner messages and maintenance mode</p>
                  </div>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Announcement Banner Text <span style={{ fontWeight: 400, textTransform: 'none' }}>(leave empty to hide)</span></label>
                    <input type="text" value={siteSettings['announcement_text'] ?? ''} onChange={e => setSetting('announcement_text', e.target.value)} placeholder="e.g. System maintenance on Friday 10pm–12am"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--dark-border)', background: 'var(--dark-bg)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Banner Color</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--dark-bg)', borderRadius: 10, border: '1.5px solid var(--dark-border)', padding: '6px 12px' }}>
                        <input type="color" value={siteSettings['announcement_color'] ?? '#f59e0b'} onChange={e => setSetting('announcement_color', e.target.value)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{siteSettings['announcement_color'] ?? '#f59e0b'}</span>
                      </div>
                    </div>
                    {siteSettings['announcement_text'] && (
                      <div style={{ flex: 1, padding: '8px 14px', borderRadius: 10, background: siteSettings['announcement_color'] ?? '#f59e0b', color: '#000', fontSize: '0.8rem', fontWeight: 600 }}>
                        Preview: {siteSettings['announcement_text']}
                      </div>
                    )}
                  </div>
                  <div style={{ height: 1, background: 'var(--dark-border)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>Maintenance Mode</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>Non-admin users will see a maintenance page</p>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={siteSettings['maintenance_mode'] === 'true'} onChange={e => setSetting('maintenance_mode', e.target.checked ? 'true' : 'false')} style={{ display: 'none' }} />
                      <div style={{
                        width: 44, height: 24, borderRadius: 12, transition: 'background 0.2s',
                        background: siteSettings['maintenance_mode'] === 'true' ? '#ef4444' : 'var(--dark-border)',
                        position: 'relative',
                      }}>
                        <div style={{
                          position: 'absolute', top: 3, left: siteSettings['maintenance_mode'] === 'true' ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                        }} />
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* ── Save bar ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, padding: '1rem 1.25rem' }}>
                <div>
                  {settingsResult && (
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: settingsResult.startsWith('Settings saved') ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {settingsResult.startsWith('Settings saved')
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                      {settingsResult}
                    </p>
                  )}
                  {!settingsResult && <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Changes apply immediately after saving</p>}
                </div>
                <button onClick={saveSiteSettings} disabled={settingsSaving}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 12, border: 'none', background: 'var(--gold)', color: '#000', fontWeight: 700, fontSize: '0.88rem', cursor: settingsSaving ? 'not-allowed' : 'pointer', opacity: settingsSaving ? 0.6 : 1 }}>
                  {settingsSaving
                    ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Saving…</>
                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Settings</>}
                </button>
              </div>

            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
