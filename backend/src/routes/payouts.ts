import { Router } from 'express';
import { generalLimiter } from '../middleware/rateLimiter';
import { feed } from '../controllers/payoutController';

const router = Router();

router.get('/feed', generalLimiter, feed);

export default router;
