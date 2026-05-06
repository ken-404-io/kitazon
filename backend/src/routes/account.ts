import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { changePassword, deleteAccount, loginHistory } from '../controllers/accountController';

const router = Router();

router.post('/change-password', authMiddleware, authLimiter, changePassword);
router.delete('/', authMiddleware, deleteAccount);
router.get('/login-history', authMiddleware, loginHistory);

export default router;
