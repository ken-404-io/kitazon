import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import adminAuth from '../middleware/adminAuth';
import { platformStats, listUsers, toggleUserActive, listWithdrawals, updateWithdrawalStatus, listAuditLogs, listTasks, createTask, updateTask, updateUserPlan, adjustBalance, broadcastEmail, revenueStats } from '../controllers/adminController';

const router = Router();

router.use(authMiddleware, adminAuth);

router.get('/stats', platformStats);
router.get('/users', listUsers);
router.patch('/users/:id/toggle-active', toggleUserActive);
router.patch('/users/:id/plan', updateUserPlan);
router.post('/users/:id/balance', adjustBalance);
router.get('/withdrawals', listWithdrawals);
router.patch('/withdrawals/:id/status', updateWithdrawalStatus);
router.get('/audit-logs', listAuditLogs);
router.get('/tasks', listTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:id', updateTask);
router.post('/broadcast', broadcastEmail);
router.get('/revenue', revenueStats);

export default router;
