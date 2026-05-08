import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter';
import { googleAuth, googleRedirect, googleCallback } from '../controllers/googleAuthController';

const router = Router();

router.get('/google/redirect', googleRedirect);
router.get('/google/callback', googleCallback);
router.post('/google', authLimiter, googleAuth);

export default router;
