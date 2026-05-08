import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { changePassword, deleteAccount, loginHistory, activeSessions, revokeOtherSessions, updateProfile } from '../controllers/accountController';

const router = Router();

router.patch('/profile', authMiddleware, updateProfile);
router.post('/change-password', authMiddleware, authLimiter, changePassword);
router.delete('/', authMiddleware, deleteAccount);
router.get('/login-history', authMiddleware, loginHistory);
router.get('/sessions', authMiddleware, activeSessions);
router.post('/revoke-sessions', authMiddleware, revokeOtherSessions);

export default router;
