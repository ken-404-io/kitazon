import { useEffect, useState, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import styles from './KycGate.module.css';

interface Props {
  children: ReactNode;
  feature: 'tasks' | 'withdrawals';
}

type KycStatus = 'none' | 'pending' | 'approved' | 'rejected';

export default function KycGate({ children, feature }: Props) {
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ kyc_status: KycStatus }>('/kyc/status')
      .then((r) => setStatus(r.data.kyc_status))
      .catch(() => setStatus('none'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className={styles.loading}>
      <span className={styles.spinner} />
    </div>
  );

  if (status === 'approved') return <>{children}</>;

  const featureLabel = feature === 'tasks' ? 'Tasks' : 'Withdrawals';

  return (
    <div className={styles.gate}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h2 className={styles.title}>KYC Required</h2>
        <p className={styles.desc}>
          You need to verify your identity before accessing <strong>{featureLabel}</strong>.
          This protects you and all Kitazon members from fraud.
        </p>

        {status === 'pending' && (
          <div className={styles.statusBadge} data-status="pending">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Verification in progress — usually 24–48 hours
          </div>
        )}

        {status === 'rejected' && (
          <div className={styles.statusBadge} data-status="rejected">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            Your previous submission was rejected. Please resubmit.
          </div>
        )}

        {status === 'none' && (
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <span>Fill out the identity form (2 minutes)</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span>Our team reviews within 24–48 hours</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <span>Get full access to tasks and withdrawals</span>
            </div>
          </div>
        )}

        <Link to="/kyc" className={styles.ctaBtn}>
          {status === 'pending' ? 'View KYC Status' : status === 'rejected' ? 'Resubmit KYC' : 'Verify My Identity'}
        </Link>
      </div>
    </div>
  );
}
