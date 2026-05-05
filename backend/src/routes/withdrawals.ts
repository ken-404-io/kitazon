import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { create, list } from '../controllers/withdrawalController';
import { AuthRequest } from '../types';

const router = Router();

router.post('/', authMiddleware, (req, res, next) => create(req as AuthRequest, res, next));
router.get('/', authMiddleware, (req, res, next) => list(req as AuthRequest, res, next));

export default router;
