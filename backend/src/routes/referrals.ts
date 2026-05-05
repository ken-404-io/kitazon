import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { get } from '../controllers/referralController';
import { AuthRequest } from '../types';

const router = Router();

router.get('/', authMiddleware, (req, res, next) => get(req as AuthRequest, res, next));

export default router;
