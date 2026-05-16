import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { createOrder, captureOrder, paypalWebhook, submitGcashPayment, getGcashPendingPlans } from '../controllers/subscriptionController';

const router = Router();

router.post('/webhook',       paypalWebhook);
router.post('/create',        authMiddleware, createOrder);
router.post('/capture',       authMiddleware, captureOrder);
router.post('/gcash-submit',  authMiddleware, submitGcashPayment);
router.get('/gcash-pending',  authMiddleware, getGcashPendingPlans);

export default router;
