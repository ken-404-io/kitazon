import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { createOrder, captureOrder } from '../controllers/subscriptionController';

const router = Router();

router.post('/create',  authMiddleware, createOrder);
router.post('/capture', authMiddleware, captureOrder);

export default router;
