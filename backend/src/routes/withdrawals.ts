import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { withdrawalLimiter, authLimiter, otpLimiter } from '../middleware/rateLimiter';
import { eligibility, requestOtp, create, list, getOne } from '../controllers/withdrawalController';

const router = Router();

router.get('/eligibility', authMiddleware, eligibility);
router.post('/request-otp', authMiddleware, authLimiter, otpLimiter, requestOtp);
router.post('/', authMiddleware, withdrawalLimiter, create);
router.get('/', authMiddleware, list);
router.get('/:id', authMiddleware, getOne);

export default router;
