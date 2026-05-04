import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { list, complete, spin, recentEarnings } from '../controllers/taskController';
import { AuthRequest } from '../types';

const router = Router();

router.get('/', authMiddleware, (req, res, next) => list(req as AuthRequest, res, next));
router.post('/:id/complete', authMiddleware, (req, res, next) => complete(req as AuthRequest, res, next));
router.post('/spin', authMiddleware, (req, res, next) => spin(req as AuthRequest, res, next));
router.get('/earnings/recent', authMiddleware, (req, res, next) => recentEarnings(req as AuthRequest, res, next));

export default router;
