import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter';
import { googleAuth } from '../controllers/googleAuthController';

const router = Router();

router.post('/google', authLimiter, googleAuth);

export default router;
