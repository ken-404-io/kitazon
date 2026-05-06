import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter';
import { register, login, logout, me, stats } from '../controllers/authController';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, me);
router.get('/me/stats', authMiddleware, stats);

export default router;
