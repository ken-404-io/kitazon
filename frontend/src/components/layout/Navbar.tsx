import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { Withdrawal } from '../../types';
import styles from './Navbar.module.css';

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const sz = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const HomeIcon    = () => <svg {...sz}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const QuizIcon    = () => <svg {...sz}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
const WalletIcon  = () => <svg {...sz}><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/><path d="M15 15h2"/></svg>;
const UserIcon    = () => <svg {...sz}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const BellIcon    = () => <svg {...sz}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
const SunIcon     = () => <svg {...sz}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const MoonIcon    = () => <svg {...sz}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>;
const ShieldIcon  = () => <svg {...sz}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>;
const TrophyIcon  = () => <svg {...sz}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-1a2 2 0 012-2h16a2 2 0 012 2v1a2 2 0 01-2 2h-2"/><rect x="8" y="18" width="8" height="4"/></svg>;
const LoginIcon   = () => <svg {...sz}><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>;
const UserPlusIcon= () => <svg {...sz}><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>;
const LogoutIcon  = () => <svg {...sz}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const UsersIcon   = () => <svg {...sz}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const SettingsIcon= () => <svg {...sz}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const CrownIcon   = () => <svg {...sz}><path d="M2 20h20"/><path d="M5 20V9l7-5 7 5v11"/><path d="M12 4v16"/><path d="M5 12h14"/></svg>;

// ─── Component ────────────────────────────────────────────────────────────────
interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [appNotifs, setAppNotifs] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('seenWithdrawals') ?? '[]'); } catch { return []; }
  });

  useEffect(() => {
    if (!user) return;
    const poll = () => {
      api.get<Withdrawal[]>('/withdrawals').then((r) => setWithdrawals(r.data)).catch(() => {});
      api.get<AppNotification[]>('/notifications').then((r) => setAppNotifs(r.data)).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [user]);

  const unreadWithdrawals = withdrawals.filter((n) => !seenIds.includes(n.id) && n.status !== 'pending').length;
  const unreadBroadcasts = appNotifs.filter((n) => !n.read_at).length;
  const unread = unreadWithdrawals + unreadBroadcasts;

  const markAllRead = () => {
    const ids = withdrawals.map((n) => n.id);
    setSeenIds(ids);
    localStorage.setItem('seenWithdrawals', JSON.stringify(ids));
    if (unreadBroadcasts > 0) {
      api.post('/notifications/read-all').then(() => {
        setAppNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      }).catch(() => {});
    }
  };

  const handleLogout = async () => {
    setNotifOpen(false);
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  const balance = Number(user?.balance ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      {/* ── Top header ─────────────────────────────────────────────────────── */}
      <header className={styles.topHeader}>
        <span className={styles.brand}>Kitazon</span>

        {/* Desktop links */}
        {user ? (
          <nav className={styles.desktopLinks}>
            <Link to="/dashboard" className={isActive('/dashboard') ? styles.activeLink : ''}>Dashboard</Link>
            <Link to="/quiz"      className={isActive('/quiz')      ? styles.activeLink : ''}>Quiz</Link>
            <Link to="/referral"  className={isActive('/referral')  ? styles.activeLink : ''}>Referral</Link>
            {user.is_admin && <Link to="/admin" className={isActive('/admin') ? styles.activeLink : ''}>Admin</Link>}
          </nav>
        ) : (
          <nav className={styles.desktopLinks}>
            <Link to="/payout-proof" className={isActive('/payout-proof') ? styles.activeLink : ''}>Payout Proof</Link>
            <Link to="/leaderboard"  className={isActive('/leaderboard')  ? styles.activeLink : ''}>Leaderboard</Link>
          </nav>
        )}

        {/* Right controls */}
        <div className={styles.controls}>
          {user && (
            <span className={styles.balanceChip}>
              <span className={styles.balanceCurrency}>₱</span>
              {balance}
            </span>
          )}

          {/* Notification bell */}
          {user && (
            <div className={styles.bellWrap}>
              <button
                className={styles.iconBtn}
                onClick={() => { setNotifOpen((o) => !o); if (!notifOpen) markAllRead(); }}
                aria-label="Notifications"
              >
                <BellIcon />
                {unread > 0 && <span className={styles.badge}>{unread}</span>}
              </button>

              {notifOpen && (
                <div className={styles.notifDropdown}>
                  {appNotifs.length > 0 && (
                    <>
                      <div className={styles.notifHeader}>Announcements</div>
                      {appNotifs.slice(0, 5).map((n) => (
                        <div key={`b-${n.id}`} className={styles.notifItem} style={{ borderLeft: `3px solid ${n.read_at ? 'var(--border)' : '#f97316'}`, paddingLeft: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.message}</div>
                          <div className={styles.notifDate}>{new Date(n.created_at).toLocaleString('en-PH')}</div>
                        </div>
                      ))}
                    </>
                  )}
                  <div className={styles.notifHeader} style={{ marginTop: appNotifs.length > 0 ? 8 : 0 }}>Withdrawal Updates</div>
                  {withdrawals.filter((n) => n.status !== 'pending').length === 0 ? (
                    <p className={styles.notifEmpty}>No updates yet.</p>
                  ) : withdrawals.filter((n) => n.status !== 'pending').slice(0, 8).map((n) => (
                    <div key={n.id} className={styles.notifItem}>
                      <span className={`${styles.notifStatus} ${styles[`status_${n.status}`]}`}>{n.status.toUpperCase()}</span>
                      {' — '}₱{Number(n.net_amount).toFixed(2)} via {n.channel.toUpperCase()}
                      <div className={styles.notifDate}>{new Date(n.created_at).toLocaleString('en-PH')}</div>
                    </div>
                  ))}
                  {appNotifs.length === 0 && withdrawals.filter(n => n.status !== 'pending').length === 0 && (
                    <p className={styles.notifEmpty}>No notifications yet.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Theme toggle */}
          <button className={styles.iconBtn} onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Desktop auth actions */}
          {user ? (
            <div className={styles.desktopActions}>
              <Link to="/withdraw"><button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Withdraw</button></Link>
              <button className={styles.iconBtn} onClick={handleLogout} aria-label="Logout" title="Logout"><LogoutIcon /></button>
            </div>
          ) : (
            <div className={styles.desktopActions}>
              <Link to="/login"><button className="btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Login</button></Link>
              <Link to="/register"><button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Sign Up</button></Link>
            </div>
          )}
        </div>
      </header>

      {/* Notif overlay */}
      {notifOpen && <div className={styles.notifOverlay} onClick={() => setNotifOpen(false)} />}

      {/* ── Bottom nav (mobile only, hidden on landing page) ───────────────── */}
      <nav className={`${styles.bottomNav}${location.pathname === '/' ? ` ${styles.bottomNavHidden}` : ''}`}>
        {user ? (
          <>
            <NavTab to="/dashboard" label="Home"    icon={<HomeIcon />}   active={isActive('/dashboard')} />
            <NavTab to="/quiz"      label="Quiz"    icon={<QuizIcon />}   active={isActive('/quiz')} />
            <NavTab to="/withdraw"  label="Wallet"  icon={<WalletIcon />} active={isActive('/withdraw')} />
            <NavTab to="/plans"     label="Upgrade" icon={<CrownIcon />}  active={isActive('/plans')} />
            <NavTab to="/account"   label="Profile" icon={<UserIcon />}   active={isActive('/account')}
              badge={!user.email_verified ? '!' : undefined} />
          </>
        ) : (
          <>
            <NavTab to="/"            label="Home"      icon={<HomeIcon />}    active={isActive('/')} />
            <NavTab to="/payout-proof"label="Proof"     icon={<ShieldIcon />}  active={isActive('/payout-proof')} />
            <NavTab to="/leaderboard" label="Leaders"   icon={<TrophyIcon />}  active={isActive('/leaderboard')} />
            <NavTab to="/login"       label="Login"     icon={<LoginIcon />}   active={isActive('/login')} />
            <NavTab to="/register"    label="Sign Up"   icon={<UserPlusIcon />}active={isActive('/register')} />
          </>
        )}
      </nav>
    </>
  );
}

function NavTab({ to, label, icon, active, badge }: {
  to: string; label: string; icon: React.ReactNode; active: boolean; badge?: string;
}) {
  return (
    <Link to={to} className={`${styles.navTab} ${active ? styles.navTabActive : ''}`}>
      <span className={styles.navTabIcon}>
        {icon}
        {badge && <span className={styles.navTabBadge}>{badge}</span>}
      </span>
      <span className={styles.navTabLabel}>{label}</span>
    </Link>
  );
}
