import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import adminAuth from '../middleware/adminAuth';
import { authLimiter } from '../middleware/rateLimiter';
import { getStatus, submit, adminList, adminApprove, adminReject } from '../controllers/kycController';

const router = Router();

router.get('/status', authMiddleware, getStatus);
router.post('/submit', authMiddleware, authLimiter, submit);

// Admin routes
router.get('/admin', authMiddleware, adminAuth, adminList);
router.post('/admin/:id/approve', authMiddleware, adminAuth, adminApprove);
router.post('/admin/:id/reject', authMiddleware, adminAuth, adminReject);

export default router;
