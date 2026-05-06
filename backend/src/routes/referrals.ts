import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { get, leaderboard } from '../controllers/referralController';

const router = Router();

router.get('/leaderboard', leaderboard);
router.get('/', authMiddleware, get);

export default router;
