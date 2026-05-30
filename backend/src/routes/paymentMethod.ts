import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { taskLimiter } from '../middleware/rateLimiter';
import { submitChangeRequest, myChangeRequest } from '../controllers/paymentMethodController';

const router = Router();

router.get('/change-requests/mine', authMiddleware, myChangeRequest);
router.post('/change-requests', authMiddleware, taskLimiter, submitChangeRequest);

export default router;
