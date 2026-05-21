import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { changePassword, loginHistory, activeSessions, revokeOtherSessions, updateProfile, updateAvatar } from '../controllers/accountController';

const router = Router();

router.patch('/profile', authMiddleware, updateProfile);
router.patch('/avatar', authMiddleware, updateAvatar);
router.post('/change-password', authMiddleware, authLimiter, changePassword);
router.get('/login-history', authMiddleware, loginHistory);
router.get('/sessions', authMiddleware, activeSessions);
router.post('/revoke-sessions', authMiddleware, revokeOtherSessions);

export default router;
