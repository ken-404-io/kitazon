import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SpinWheel from '../components/dashboard/SpinWheel';
import { SkeletonRow } from '../components/ui/Skeleton';
import api from '../services/api';
import { UserStats, Earning } from '../types';
import { FACEBOOK_PAGE_URL } from '../components/FacebookFab';
import styles from './Dashboard.module.css';

const FacebookIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
    <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"/>
  </svg>
);

const MegaphoneIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 11l18-8v18l-18-8z"/>
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
  </svg>
);

const ThumbsUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 10v12"/>
    <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.34-9a1.93 1.93 0 0 1 1.66 1c.34.59.5 1.27.5 2v1.88z"/>
  </svg>
);

/* ─── Nav shortcut icons ─────────────────────────────────────────────────── */
const sz18 = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ORANGE = '#f97316';

type NavItem = { label: string; icon: JSX.Element } & ({ to: string; scroll?: never } | { scroll: string; to?: never });

const NAV_ITEMS: NavItem[] = [
  { label: 'Quiz',     to: '/quiz',                          icon: <svg {...sz18}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
  { label: 'Withdraw', to: '/withdraw',                      icon: <svg {...sz18}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
  { label: 'Invite',   to: '/referral',                      icon: <svg {...sz18}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { label: 'Spin',     scroll: 'spin-section',               icon: <svg {...sz18}><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg> },
  { label: 'Check-in', to: '/checkin',                         icon: <svg {...sz18}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { label: 'Credits',  to: '/credits',                       icon: <svg {...sz18}><circle cx="12" cy="12" r="10"/><path d="M15 9.5a3.5 3.5 0 1 0-3 5.5"/></svg> },
  { label: 'Plans',    to: '/plans',                         icon: <svg {...sz18}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  { label: 'History',  to: '/withdraw?view=history',         icon: <svg {...sz18}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { label: 'KYC',      to: '/kyc',                           icon: <svg {...sz18}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="9 11 12 14 22 4"/></svg> },
];

function earningIcon(type: string) {
  if (type === 'spin') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="3"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  );
  if (type === 'referral' || type === 'referral_commission') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    </svg>
  );
  if (type === 'checkin') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 15 11 17 15 13"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function Dashboard() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const navigate      = useNavigate();
  const [stats,          setStats]          = useState<UserStats | null>(null);
  const [recentEarnings, setRecentEarnings] = useState<Earning[]>([]);
  const [loadingStats,   setLoadingStats]   = useState(true);
  const [loadingEarnings,setLoadingEarnings]= useState(true);
  const [kycStatus, setKycStatus] = useState<'none'|'pending'|'approved'|'rejected'>('none');

  const loadStats = (): void => {
    api.get<UserStats>('/auth/me/stats').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoadingStats(false));
  };

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    api.get<{ kyc_status: string }>('/kyc/status')
      .then(r => setKycStatus(r.data.kyc_status as any))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setLoadingEarnings(true);
    api.get<{ earnings: Earning[] }>('/tasks/earnings/recent?page=1')
      .then(r => setRecentEarnings(r.data.earnings))
      .catch(() => {})
      .finally(() => setLoadingEarnings(false));
  }, []);

  const balance  = Number(stats?.balance ?? 0);
  const today    = Number(stats?.today   ?? 0);
  const week     = Number(stats?.week    ?? 0);
  const total    = Number(stats?.total   ?? 0);

  return (
    <div className="page-container">
      <div className={styles.page}>

        {/* ── KYC banner ── */}
        {kycStatus !== 'approved' && (
          <Link to="/kyc" className={`${styles.kycBanner} ${styles[`kycBanner_${kycStatus}`]}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span>
              {kycStatus === 'none'     && 'Verify your identity to unlock tasks and withdrawals'}
              {kycStatus === 'pending'  && 'KYC under review — tasks and withdrawals are locked'}
              {kycStatus === 'rejected' && 'KYC rejected — resubmit to unlock tasks and withdrawals'}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        )}

        {/* ── Greeting + Facebook page card ── */}
        <div className={styles.greetingRow}>
          <div>
            <p className={styles.greetSub}>Welcome back,</p>
            <h1 className={styles.greetName}>{user?.name?.split(' ')[0] ?? 'User'}</h1>
          </div>
          <a
            href={FACEBOOK_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.fbCard}
          >
            <span className={styles.fbCardIcon}><FacebookIcon /></span>
            <span className={styles.fbCardText}>
              <strong>Like our Facebook Page</strong>
              <span>to connect &amp; get updates</span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>

        {/* ── Stay Connected promo banner ── */}
        <a
          href={FACEBOOK_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.promoBanner}
        >
          <span className={styles.promoIcon}><MegaphoneIcon /></span>
          <span className={styles.promoText}>
            <strong>Stay Connected. Stay Updated.</strong>
            <span>Like our Facebook Page to get the latest announcements, features, and important updates.</span>
          </span>
          <span className={styles.promoBtn}>
            <ThumbsUpIcon /> Like Page
          </span>
        </a>

        {/* ── Navigation grid ── */}
        <p className={styles.sectionLabel}>Navigation</p>
        <div className={styles.navGrid}>
          {NAV_ITEMS.map(item => {
            const inner = (
              <>
                <div className={styles.navIconWrap} style={{ color: ORANGE }}>{item.icon}</div>
                <span className={styles.navLabel}>{item.label}</span>
              </>
            );
            if (item.scroll) return (
              <button
                key={item.label}
                className={styles.navItem}
                onClick={() => document.getElementById(item.scroll!)?.scrollIntoView({ behavior: 'smooth' })}
              >{inner}</button>
            );
            return <Link key={item.label} to={item.to!} className={styles.navItem}>{inner}</Link>;
          })}
        </div>

        {/* ── Overview section ── */}
        <div className={styles.overviewHeader}>
          <div>
            <p className={styles.sectionLabel} style={{ marginBottom: 2 }}>Earnings Overview</p>
            <p className={styles.overviewSub}>Your complete earnings at a glance</p>
          </div>
        </div>

        {/* ── Big balance card ── */}
        <div className={styles.balanceCard}>
          <div className={styles.balanceCardTop}>
            <div>
              <p className={styles.balanceCardLabel}>Total Balance</p>
              {loadingStats
                ? <div className={styles.balanceSkeleton} />
                : <p className={styles.balanceCardAmt}>₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              }
            </div>
            <button
              className={styles.withdrawQuickBtn}
              onClick={() => navigate('/withdraw')}
            >
              Withdraw →
            </button>
          </div>

          <div className={styles.balanceStats}>
            <div className={styles.balanceStat}>
              <p className={styles.balanceStatLabel}>Today</p>
              <p className={styles.balanceStatVal}>+₱{today.toFixed(2)}</p>
            </div>
            <div className={styles.balanceStatDivider} />
            <div className={styles.balanceStat}>
              <p className={styles.balanceStatLabel}>This Week</p>
              <p className={styles.balanceStatVal}>+₱{week.toFixed(2)}</p>
            </div>
            <div className={styles.balanceStatDivider} />
            <div className={styles.balanceStat}>
              <p className={styles.balanceStatLabel}>All Time</p>
              <p className={styles.balanceStatVal}>₱{total.toFixed(2)}</p>
            </div>
          </div>

        </div>

        {/* ── Connect & Follow ── */}
        <p className={styles.sectionLabel} style={{ marginTop: '1.5rem' }}>Connect &amp; Follow</p>
        <p className={styles.overviewSub} style={{ marginBottom: '0.85rem' }}>Follow us to never miss an update!</p>
        <a
          href={FACEBOOK_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.connectCard}
        >
          <span className={styles.connectIcon}><FacebookIcon size={36} /></span>
          <span className={styles.connectText}>
            <strong>Kitazon Official</strong>
            <span>Announcements, updates, promos &amp; more!</span>
          </span>
          <span className={styles.connectBtn}>
            <ThumbsUpIcon /> Like Page
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.connectChev}><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        {/* ── Sub cards row ── */}
        <div className={styles.subCards}>
          {/* Recent Earnings */}
          <div className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <span className={styles.subCardTitle}>Recent Earnings</span>
              <Link to="/tasks" className={styles.subCardLink}>See all →</Link>
            </div>
            {loadingEarnings
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              : recentEarnings.length === 0
                ? <p className={styles.emptyMsg}>No earnings yet. <Link to="/tasks">Start a task!</Link></p>
                : recentEarnings.slice(0, 3).map(e => (
                  <div key={e.id} className={styles.earningRow}>
                    <div className={styles.earningIconWrap}>{earningIcon(e.type)}</div>
                    <div className={styles.earningMeta}>
                      <p className={styles.earningTitle}>{e.task_title}</p>
                      <p className={styles.earningTime}>{new Date(e.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className={styles.earningAmt}>+₱{Number(e.amount).toFixed(2)}</span>
                  </div>
                ))
            }
          </div>

          {/* Daily Spin */}
          <div id="spin-section" className={styles.subCard} style={{ overflow: 'hidden' }}>
            <p className={styles.subCardTitle} style={{ marginBottom: '0.75rem' }}>Daily Spin</p>
            <SpinWheel onWin={() => { loadStats(); showToast('Spin reward added to your balance!', 'success'); }} />
          </div>
        </div>

      </div>
    </div>
  );
}
