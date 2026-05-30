import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { taskLimiter } from '../middleware/rateLimiter';
import { list, complete, spin, recentEarnings, earningsChart, dailyCheckin, quizCorrect, quizStatus, claimWelcomeBonus } from '../controllers/taskController';

const router = Router();

router.get('/', authMiddleware, list);
router.post('/checkin', authMiddleware, dailyCheckin);
router.post('/claim-bonus', authMiddleware, taskLimiter, claimWelcomeBonus);
router.post('/spin', authMiddleware, taskLimiter, spin);
router.post('/quiz/correct', authMiddleware, taskLimiter, quizCorrect);
router.get('/quiz/status', authMiddleware, quizStatus);
router.get('/earnings/recent', authMiddleware, recentEarnings);
router.get('/earnings/chart', authMiddleware, earningsChart);
router.post('/:id/complete', authMiddleware, taskLimiter, complete);

export default router;
