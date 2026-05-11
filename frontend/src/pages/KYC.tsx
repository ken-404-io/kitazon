import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import styles from './KYC.module.css';

const ID_TYPES = [
  { value: 'philsys',         label: 'PhilSys National ID' },
  { value: 'passport',        label: 'Philippine Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'umid',            label: 'UMID (SSS / GSIS)' },
  { value: 'voters_id',       label: "Voter's ID" },
  { value: 'prc_id',          label: 'PRC ID' },
  { value: 'national_id',     label: 'Other National ID' },
];

interface KycStatus {
  kyc_status: 'none' | 'pending' | 'approved' | 'rejected';
  kyc_rejection_reason: string | null;
}

type CaptureTarget = 'id_front' | 'id_back' | 'selfie';

export default function KYC() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [status, setStatus]     = useState<KycStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [step, setStep]         = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // Captured images (base64 data URLs)
  const [idFront,  setIdFront]  = useState<string | null>(null);
  const [idBack,   setIdBack]   = useState<string | null>(null);
  const [selfie,   setSelfie]   = useState<string | null>(null);

  // Camera state
  const [cameraTarget, setCameraTarget] = useState<CaptureTarget | null>(null);
  const [cameraReady,  setCameraReady]  = useState(false);
  const [cameraError,  setCameraError]  = useState<string | null>(null);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  // Step 2 form
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

  // ── Camera helpers ──────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setCameraError(null);
  }, []);

  const openCamera = useCallback(async (target: CaptureTarget) => {
    stopCamera();
    setCameraTarget(target);
    setCameraError(null);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: target === 'selfie' ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions and try again.');
    }
  }, [stopCamera]);

  const capturePhoto = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (cameraTarget === 'id_front')  setIdFront(dataUrl);
    if (cameraTarget === 'id_back')   setIdBack(dataUrl);
    if (cameraTarget === 'selfie')    setSelfie(dataUrl);
    stopCamera();
    setCameraTarget(null);
  }, [cameraTarget, stopCamera]);

  // ── File upload fallback ────────────────────────────────────────────────────
  const handleFileUpload = (target: CaptureTarget) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (target === 'id_front') setIdFront(result);
      if (target === 'id_back')  setIdBack(result);
      if (target === 'selfie')   setSelfie(result);
    };
    reader.readAsDataURL(file);
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/kyc/submit', {
        ...form,
        id_front_data: idFront,
        id_back_data:  idBack,
        selfie_data:   selfie,
      });
      showToast('KYC submitted! We will review within 24–48 hours.', 'success');
      setStatus({ kyc_status: 'pending', kyc_rejection_reason: null });
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className={styles.page}><p className={styles.loading}>Loading…</p></div>;

  // Already approved or pending — just show banner
  if (status?.kyc_status === 'approved' || status?.kyc_status === 'pending') {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
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

          {status.kyc_status === 'approved' && (
            <div className={`${styles.banner} ${styles.bannerSuccess}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Your identity has been verified. You have full access to tasks and withdrawals.
            </div>
          )}
          {status.kyc_status === 'pending' && (
            <div className={`${styles.banner} ${styles.bannerWarning}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Your KYC is under review. We typically respond within 24–48 hours.
            </div>
          )}

          {status.kyc_status === 'approved' && (
            <button className={styles.doneBtn} onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>Identity Verification</h1>
            <p className={styles.subtitle}>Complete KYC to unlock tasks and withdrawals</p>
          </div>
        </div>

        {/* Rejection banner */}
        {status?.kyc_status === 'rejected' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span>
              <strong>Verification rejected.</strong> Reason: {status.kyc_rejection_reason ?? 'No reason provided.'}
              <br /><small>Please resubmit with correct information.</small>
            </span>
          </div>
        )}

        {/* Step indicator */}
        <div className={styles.stepBar}>
          <div className={`${styles.stepDot} ${step >= 1 ? styles.stepDotActive : ''}`}>1</div>
          <div className={`${styles.stepLine} ${step >= 2 ? styles.stepLineActive : ''}`} />
          <div className={`${styles.stepDot} ${step >= 2 ? styles.stepDotActive : ''}`}>2</div>
        </div>
        <div className={styles.stepLabels}>
          <span className={step === 1 ? styles.stepLabelActive : ''}>Document Upload</span>
          <span className={step === 2 ? styles.stepLabelActive : ''}>Personal Info</span>
        </div>

        {/* Camera modal overlay */}
        {cameraTarget && (
          <div className={styles.cameraOverlay}>
            <div className={styles.cameraModal}>
              <p className={styles.cameraTitle}>
                {cameraTarget === 'id_front' ? 'Capture ID Front' : cameraTarget === 'id_back' ? 'Capture ID Back' : 'Take a Selfie'}
              </p>

              {cameraError ? (
                <div className={styles.cameraError}>{cameraError}</div>
              ) : (
                <div className={styles.cameraViewport}>
                  <video ref={videoRef} autoPlay playsInline muted className={styles.cameraVideo}
                    style={{ transform: cameraTarget === 'selfie' ? 'scaleX(-1)' : 'none' }}
                  />
                  {cameraReady && (
                    <div className={styles.cameraTrace}>
                      {cameraTarget === 'selfie' ? (
                        <div className={styles.selfieOval} />
                      ) : (
                        <div className={styles.idRect}>
                          <span className={`${styles.corner} ${styles.cornerTL}`} />
                          <span className={`${styles.corner} ${styles.cornerTR}`} />
                          <span className={`${styles.corner} ${styles.cornerBL}`} />
                          <span className={`${styles.corner} ${styles.cornerBR}`} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div className={styles.cameraBtns}>
                {!cameraError && cameraReady && (
                  <button className={styles.captureBtn} onClick={capturePhoto}>
                    <span className={styles.captureInner} />
                  </button>
                )}
                <button className={styles.cameraCancelBtn} onClick={() => { stopCamera(); setCameraTarget(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: Document Upload ── */}
        {step === 1 && (
          <div className={styles.form}>
            <p className={styles.formSection}>Government ID</p>

            {[
              { key: 'id_front' as CaptureTarget, label: 'ID Front', hint: 'Front side of your government ID', image: idFront, set: setIdFront },
              { key: 'id_back'  as CaptureTarget, label: 'ID Back',  hint: 'Back side of your government ID', image: idBack,  set: setIdBack  },
            ].map(({ key, label, hint, image, set: setImg }) => (
              <div key={key} className={styles.docSlot}>
                <div className={styles.docSlotInfo}>
                  <p className={styles.docSlotLabel}>{label}</p>
                  <p className={styles.docSlotHint}>{hint}</p>
                </div>
                {image ? (
                  <div className={styles.docPreview}>
                    <img src={image} alt={label} className={styles.docPreviewImg} />
                    <button className={styles.docRetakeBtn} onClick={() => setImg(null)}>Retake</button>
                  </div>
                ) : (
                  <div className={styles.docActions}>
                    <button className={styles.docCameraBtn} onClick={() => openCamera(key)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      Camera
                    </button>
                    <label className={styles.docUploadBtn}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Upload
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload(key)} />
                    </label>
                  </div>
                )}
              </div>
            ))}

            <p className={styles.formSection} style={{ marginTop: '0.5rem' }}>Selfie Verification</p>

            <div className={styles.docSlot}>
              <div className={styles.docSlotInfo}>
                <p className={styles.docSlotLabel}>Selfie with ID</p>
                <p className={styles.docSlotHint}>Hold your ID next to your face</p>
              </div>
              {selfie ? (
                <div className={styles.docPreview}>
                  <img src={selfie} alt="Selfie" className={styles.docPreviewImg} style={{ borderRadius: '50%' }} />
                  <button className={styles.docRetakeBtn} onClick={() => setSelfie(null)}>Retake</button>
                </div>
              ) : (
                <div className={styles.docActions}>
                  <button className={styles.docCameraBtn} onClick={() => openCamera('selfie')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    Camera
                  </button>
                  <label className={styles.docUploadBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Upload
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload('selfie')} />
                  </label>
                </div>
              )}
            </div>

            <button
              className={styles.submitBtn}
              onClick={() => setStep(2)}
              disabled={!idFront || !idBack || !selfie}
            >
              Continue to Step 2
            </button>
          </div>
        )}

        {/* ── Step 2: Personal Info ── */}
        {step === 2 && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <button type="button" className={styles.backBtn} onClick={() => setStep(1)}>
              ← Back to documents
            </button>

            <p className={styles.formSection}>Personal Information</p>

            <div className={styles.field}>
              <label className={styles.label}>Full Legal Name</label>
              <input className={styles.input} type="text" placeholder="As it appears on your ID"
                value={form.full_name} onChange={set('full_name')} required />
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Date of Birth</label>
                <input className={styles.input} type="date" value={form.date_of_birth} onChange={set('date_of_birth')} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Nationality</label>
                <input className={styles.input} type="text" value={form.nationality} onChange={set('nationality')} required />
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
                <input className={styles.input} type="text" placeholder="e.g. 1234-5678-9012"
                  value={form.id_number} onChange={set('id_number')} required />
              </div>
            </div>

            <p className={styles.formSection}>Home Address</p>

            <div className={styles.field}>
              <label className={styles.label}>Street Address</label>
              <input className={styles.input} type="text" placeholder="House no., street, barangay"
                value={form.address} onChange={set('address')} required />
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>City / Municipality</label>
                <input className={styles.input} type="text" value={form.city} onChange={set('city')} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Province</label>
                <input className={styles.input} type="text" value={form.province} onChange={set('province')} required />
              </div>
            </div>

            <p className={styles.consent}>
              By submitting, you confirm that all information is accurate and authorize Kitazon to verify your identity.
              Your data is protected under our <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
            </p>

            <button className={styles.submitBtn} type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for Verification'}
            </button>
          </form>
        )}

        {/* Why KYC */}
        {step === 1 && (
          <div className={styles.whyCard}>
            <p className={styles.whyTitle}>Why is KYC required?</p>
            <ul className={styles.whyList}>
              {[
                'Prevent fraud and protect all Kitazon members',
                'Comply with financial regulations (AML/KYC laws)',
                'Ensure payouts go to real, verified individuals',
                'Your data is encrypted and never shared with third parties',
              ].map(item => (
                <li key={item}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
