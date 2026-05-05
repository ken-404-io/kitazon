import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../middleware/auth';
import { register, login, me, stats } from '../controllers/authController';
import { AuthRequest } from '../types';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, (req, res, next) => me(req as AuthRequest, res, next));
router.get('/me/stats', authMiddleware, (req, res, next) => stats(req as AuthRequest, res, next));

export default router;
