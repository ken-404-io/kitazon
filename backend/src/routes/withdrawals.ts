import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { create, list } from '../controllers/withdrawalController';

const router = Router();

router.post('/', authMiddleware, create);
router.get('/', authMiddleware, list);

export default router;
