import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { withdrawalLimiter, authLimiter, otpLimiter } from '../middleware/rateLimiter';
import { eligibility, savedAccount, requestOtp, create, list, getOne, clearPaymentMethod } from '../controllers/withdrawalController';

const router = Router();

router.get('/eligibility', authMiddleware, eligibility);
router.get('/saved-account', authMiddleware, savedAccount);
router.delete('/saved-account', authMiddleware, clearPaymentMethod);
router.post('/request-otp', authMiddleware, authLimiter, otpLimiter, requestOtp);
router.post('/', authMiddleware, withdrawalLimiter, create);
router.get('/', authMiddleware, list);
router.get('/:id', authMiddleware, getOne);

export default router;
