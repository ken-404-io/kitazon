import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { withdrawalLimiter, authLimiter } from '../middleware/rateLimiter';
import { requestOtp, create, list, getOne } from '../controllers/withdrawalController';

const router = Router();

router.post('/request-otp', authMiddleware, authLimiter, requestOtp);
router.post('/', authMiddleware, withdrawalLimiter, create);
router.get('/', authMiddleware, list);
router.get('/:id', authMiddleware, getOne);

export default router;
