import { useEffect, useState } from 'react';
import api from '../services/api';
import { ReferralStats, ReferralEntry } from '../types';
import { CheckIcon } from '../components/ui/Icons';
import styles from './Referral.module.css';

interface ReferralResponse {
  stats: ReferralStats;
  list: ReferralEntry[];
}

function initials(name: string): string {
  return name.split(/[\s,]+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function avatarColor(name: string): string {
  const colors = ['#7c3aed', '#0284c7', '#059669', '#dc2626', '#d97706', '#db2777'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[Math.abs(h)];
}

export default function Referral() {
  const [data, setData]         = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [copied, setCopied]     = useState(false);
  const [showAll, setShowAll]   = useState(false);

  useEffect(() => {
    api.get<ReferralResponse>('/referrals')
      .then((res) => { setData(res.data.stats); setReferrals(res.data.list); })
      .catch(() => {});
  }, []);

  const link = `${window.location.origin}/register?ref=${data?.referral_code ?? ''}`;

  const copy = (): void => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = (): void => {
    if (navigator.share) {
      navigator.share({ title: 'Join Kitazon', text: 'Earn money online with Kitazon!', url: link }).catch(() => {});
    } else {
      copy();
    }
  };

  const count    = Number(data?.referral_count ?? 0);
  const earnings = Number(data?.lifetime_earnings ?? 0);
  const visible  = showAll ? referrals : referrals.slice(0, 5);

  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>Referral Program</h1>
          <p className={styles.heroSub}>
            Earn ₱50 per referred signup
          </p>
        </div>
        <div className={styles.heroIcon} aria-hidden="true">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <rect width="80" height="80" rx="20" fill="rgba(245,158,11,0.12)" />
            <path d="M52 28a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM28 52a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM64 52a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" stroke="#f59e0b" strokeWidth="2.5" fill="none"/>
            <path d="M44 34l-12 12M44 34l12 12" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* ── Bonus callout ── */}
      <div className={styles.bonuses}>
        <div className={styles.bonusCard}>
          <span className={styles.bonusAmt}>₱50</span>
          <span className={styles.bonusLabel}>per signup bonus</span>
        </div>
      </div>

      {/* ── Link card ── */}
      <div className={`card ${styles.linkCard}`}>
        <div className={styles.linkCardLeft}>
          <h3 className={styles.linkTitle}>Your Referral Link</h3>
          <p className={styles.linkDesc}>
            Share your link and start earning ₱50 for every user who signs up.
          </p>
          <div className={styles.linkRow}>
            <span className={styles.linkText}>{link}</span>
            <button className="btn-primary" onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontSize: 13, padding: '0.5rem 1rem' }}>
              {copied ? <><CheckIcon /> Copied</> : <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </>}
            </button>
          </div>
        </div>
        <div className={styles.linkCardRight}>
          <button className={styles.shareBtn} onClick={share}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span>Invite more<br/>Earn more</span>
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className={`card ${styles.statsCard}`}>
        <div className={styles.stat}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <div>
            <p className={styles.statNum}>{count}</p>
            <p className={styles.statLabel}>Referrals</p>
          </div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          <div>
            <p className={styles.statNum}>₱{earnings.toFixed(2)}</p>
            <p className={styles.statLabel}>Earned</p>
          </div>
        </div>
      </div>

      {/* ── Referral list ── */}
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <h3>Your Referrals ({count})</h3>
          {referrals.length > 5 && (
            <button className={styles.viewAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show less' : 'View all'} &rsaquo;
            </button>
          )}
        </div>

        {referrals.length === 0 ? (
          <div className={`card ${styles.empty}`}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            <p>No referrals yet</p>
            <span>Share your link and start earning!</span>
          </div>
        ) : (
          <div className={styles.list}>
            {visible.map((r) => (
              <div key={r.id} className={`card ${styles.referralRow}`}>
                <div className={styles.avatar} style={{ background: avatarColor(r.name) }}>
                  {initials(r.name)}
                </div>
                <div className={styles.referralInfo}>
                  <p className={styles.referralName}>{r.name}</p>
                  <p className={styles.referralDate}>Joined {new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className={styles.referralEarned}>
                  <span className={styles.earnedAmt}>₱{Number(r.commission_earned ?? 0).toFixed(2)}</span>
                  <span className={styles.earnedLabel}>earned</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
