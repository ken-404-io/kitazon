import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { get } from '../controllers/referralController';

const router = Router();

router.get('/', authMiddleware, get);

export default router;
