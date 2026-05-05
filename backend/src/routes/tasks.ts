import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { list, complete, spin, recentEarnings } from '../controllers/taskController';

const router = Router();

router.get('/', authMiddleware, list);
router.post('/spin', authMiddleware, spin);
router.get('/earnings/recent', authMiddleware, recentEarnings);
router.post('/:id/complete', authMiddleware, complete);

export default router;
