import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { getOverview, submitInvestment, requestWithdrawal } from '../controllers/investmentController';

const router = Router();

router.get('/',         authMiddleware, getOverview);
router.post('/',        authMiddleware, submitInvestment);
router.post('/withdraw', authMiddleware, requestWithdrawal);

export default router;
