import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { withdrawalLimiter, authLimiter } from '../middleware/rateLimiter';
import { requestOtp, create, list } from '../controllers/withdrawalController';

const router = Router();

router.post('/request-otp', authMiddleware, authLimiter, requestOtp);
router.post('/', authMiddleware, withdrawalLimiter, create);
router.get('/', authMiddleware, list);

export default router;
