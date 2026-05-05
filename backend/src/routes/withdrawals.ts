import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { withdrawalLimiter } from '../middleware/rateLimiter';
import { create, list } from '../controllers/withdrawalController';

const router = Router();

router.post('/', authMiddleware, withdrawalLimiter, create);
router.get('/', authMiddleware, list);

export default router;
