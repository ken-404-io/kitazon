import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { getCredits, convertToCredits } from '../controllers/creditsController';

const router = Router();

router.get('/', authMiddleware, getCredits);
router.post('/convert', authMiddleware, generalLimiter, convertToCredits);

export default router;
