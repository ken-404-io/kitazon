import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import styles from './KYC.module.css';

const ID_TYPES = [
  { value: 'philsys',        label: 'PhilSys National ID' },
  { value: 'passport',       label: 'Philippine Passport' },
  { value: 'drivers_license',label: "Driver's License" },
  { value: 'umid',           label: 'UMID (SSS / GSIS)' },
  { value: 'voters_id',      label: "Voter's ID" },
  { value: 'prc_id',         label: 'PRC ID' },
  { value: 'national_id',    label: 'Other National ID' },
];

interface KycStatus {
  kyc_status: 'none' | 'pending' | 'approved' | 'rejected';
  kyc_rejection_reason: string | null;
}

export default function KYC() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', nationality: 'Filipino',
    id_type: '', id_number: '', address: '', city: '', province: '',
  });

  useEffect(() => {
    api.get<KycStatus>('/kyc/status')
      .then((r) => setStatus(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/kyc/submit', form);
      showToast('KYC submitted! We will review within 24–48 hours.', 'success');
      setStatus({ kyc_status: 'pending', kyc_rejection_reason: null });
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className={styles.page}><p className={styles.loading}>Loading…</p></div>;

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
              <polyline points="9 11 12 14 22 4" stroke="#22c55e" strokeWidth="2.5"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>Identity Verification</h1>
            <p className={styles.subtitle}>Complete KYC to unlock tasks and withdrawals</p>
          </div>
        </div>

        {/* Status banners */}
        {status?.kyc_status === 'approved' && (
          <div className={`${styles.banner} ${styles.bannerSuccess}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Your identity has been verified. You have full access to tasks and withdrawals.
          </div>
        )}

        {status?.kyc_status === 'pending' && (
          <div className={`${styles.banner} ${styles.bannerWarning}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Your KYC is under review. We typically respond within 24–48 hours.
          </div>
        )}

        {status?.kyc_status === 'rejected' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span>
              <strong>Verification rejected.</strong> Reason: {status.kyc_rejection_reason ?? 'No reason provided.'}
              <br /><small>Please resubmit with correct information.</small>
            </span>
          </div>
        )}

        {/* Why KYC */}
        {status?.kyc_status !== 'approved' && (
          <div className={styles.whyCard}>
            <p className={styles.whyTitle}>Why is KYC required?</p>
            <ul className={styles.whyList}>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Prevent fraud and protect all Kitazon members
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Comply with financial regulations (AML/KYC laws)
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Ensure payouts go to real, verified individuals
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Your data is encrypted and never shared with third parties
              </li>
            </ul>
          </div>
        )}

        {/* Form — shown if not approved/pending */}
        {(status?.kyc_status === 'none' || status?.kyc_status === 'rejected') && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <p className={styles.formSection}>Personal Information</p>

            <div className={styles.field}>
              <label className={styles.label}>Full Legal Name</label>
              <input
                className={styles.input}
                type="text"
                placeholder="As it appears on your ID"
                value={form.full_name}
                onChange={set('full_name')}
                required
              />
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Date of Birth</label>
                <input
                  className={styles.input}
                  type="date"
                  value={form.date_of_birth}
                  onChange={set('date_of_birth')}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Nationality</label>
                <input
                  className={styles.input}
                  type="text"
                  value={form.nationality}
                  onChange={set('nationality')}
                  required
                />
              </div>
            </div>

            <p className={styles.formSection}>Government ID</p>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>ID Type</label>
                <select className={styles.input} value={form.id_type} onChange={set('id_type')} required>
                  <option value="">Select ID type</option>
                  {ID_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>ID Number</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. 1234-5678-9012"
                  value={form.id_number}
                  onChange={set('id_number')}
                  required
                />
              </div>
            </div>

            <p className={styles.formSection}>Home Address</p>

            <div className={styles.field}>
              <label className={styles.label}>Street Address</label>
              <input
                className={styles.input}
                type="text"
                placeholder="House no., street, barangay"
                value={form.address}
                onChange={set('address')}
                required
              />
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>City / Municipality</label>
                <input
                  className={styles.input}
                  type="text"
                  value={form.city}
                  onChange={set('city')}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Province</label>
                <input
                  className={styles.input}
                  type="text"
                  value={form.province}
                  onChange={set('province')}
                  required
                />
              </div>
            </div>

            <p className={styles.consent}>
              By submitting, you confirm that all information is accurate and authorize Kitazon to verify your identity.
              Your data is protected under our <a href="/privacy" target="_blank">Privacy Policy</a>.
            </p>

            <button className={styles.submitBtn} type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for Verification'}
            </button>
          </form>
        )}

        {status?.kyc_status === 'approved' && (
          <button className={styles.doneBtn} onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
