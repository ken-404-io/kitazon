import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { register, login, me, stats } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, me);
router.get('/me/stats', authMiddleware, stats);

export default router;
