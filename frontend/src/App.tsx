import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import AnnouncementBanner from './components/AnnouncementBanner';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Withdraw from './pages/Withdraw';
import ChangeWithdrawalMethod from './pages/ChangeWithdrawalMethod';
import Referral from './pages/Referral';
import PayoutProof from './pages/PayoutProof';
import VerifyEmail from './pages/VerifyEmail';
import AccountSettings from './pages/AccountSettings';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Admin from './pages/Admin';
import Leaderboard from './pages/Leaderboard';
import WithdrawalReceipt from './pages/WithdrawalReceipt';
import Bonus from './pages/Bonus';
import Guide from './pages/Guide';
import { ReactNode } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import AuthTransitionOverlay from './components/AuthTransitionOverlay';
import AdBlockDetector from './components/AdBlockDetector';
import FacebookFab from './components/FacebookFab';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Plans from './pages/Plans';
import AuthCallback from './pages/AuthCallback';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import ReferralLanding from './pages/ReferralLanding';
import Credits from './pages/Credits';
import CheckIn from './pages/CheckIn';
import KYC from './pages/KYC';
import MathQuiz from './pages/MathQuiz';
import KitaGrow from './pages/KitaGrow';
import AdManager from './components/AdManager';
import PromoPopup from './components/PromoPopup';

function MaintenanceGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings, loadingSettings } = useSettings();
  if (!loadingSettings && settings.maintenance_mode === 'true' && !user?.is_admin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔧</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>We'll be right back</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: 400 }}>Kitazon is undergoing scheduled maintenance. Please check back shortly.</p>
      </div>
    );
  }
  return <>{children}</>;
}

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gold)' }}>Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <AuthProvider>
      <SettingsProvider>
      <ToastProvider>
      <BrowserRouter>
        <MaintenanceGuard>
        <AdManager />
        <AdBlockDetector />
        <AuthTransitionOverlay />
        <PWAInstallPrompt />
        <Navbar />
        <AnnouncementBanner />
        <PromoPopup />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/payout-proof" element={<PayoutProof />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/tasks" element={<PrivateRoute><Tasks /></PrivateRoute>} />
          <Route path="/withdraw" element={<PrivateRoute><Withdraw /></PrivateRoute>} />
          <Route path="/change-withdrawal-method" element={<PrivateRoute><ChangeWithdrawalMethod /></PrivateRoute>} />
          <Route path="/referral" element={<PrivateRoute><Referral /></PrivateRoute>} />
          <Route path="/account" element={<PrivateRoute><AccountSettings /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/withdrawals/:id/receipt" element={<PrivateRoute><WithdrawalReceipt /></PrivateRoute>} />
          <Route path="/bonus" element={<PrivateRoute><Bonus /></PrivateRoute>} />
          <Route path="/guide" element={<PrivateRoute><Guide /></PrivateRoute>} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/plans" element={<PrivateRoute><Plans /></PrivateRoute>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/payment/success" element={<PrivateRoute><PaymentSuccess /></PrivateRoute>} />
          <Route path="/payment/cancel"  element={<PrivateRoute><PaymentCancel /></PrivateRoute>} />
          <Route path="/credits" element={<PrivateRoute><Credits /></PrivateRoute>} />
          <Route path="/checkin" element={<PrivateRoute><CheckIn /></PrivateRoute>} />
          <Route path="/kyc" element={<PrivateRoute><KYC /></PrivateRoute>} />
          <Route path="/quiz" element={<PrivateRoute><MathQuiz /></PrivateRoute>} />
          <Route path="/kitagrow" element={<PrivateRoute><KitaGrow /></PrivateRoute>} />
          <Route path="/ref/:code" element={<ReferralLanding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
        <FacebookFab />
        </MaintenanceGuard>
      </BrowserRouter>
      </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
