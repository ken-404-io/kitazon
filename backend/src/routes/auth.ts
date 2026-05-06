import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter';
import { register, login, refresh, logout, verifyEmail, resendVerification, me, stats, forgotPassword, resetPassword } from '../controllers/authController';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', authMiddleware, logout);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', authMiddleware, resendVerification);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/me', authMiddleware, me);
router.get('/me/stats', authMiddleware, stats);

export default router;
