import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { setupTotp, verifyAndEnableTotp, disableTotp } from '../controllers/totpController';

const router = Router();

router.post('/setup', authMiddleware, setupTotp);
router.post('/verify', authMiddleware, verifyAndEnableTotp);
router.post('/disable', authMiddleware, disableTotp);

export default router;
