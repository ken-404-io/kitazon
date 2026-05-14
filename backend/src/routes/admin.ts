import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import adminAuth from '../middleware/adminAuth';
import { platformStats, listUsers, toggleUserActive, listWithdrawals, updateWithdrawalStatus, listAuditLogs, listTasks, createTask, updateTask, updateUserPlan, adjustBalance, broadcastEmail, revenueStats, bulkImportTasks, grantLeaderboardRewards, listOnlineUsers, triggerPayout, triggerPayoutBatch } from '../controllers/adminController';

const router = Router();

router.use(authMiddleware, adminAuth);

router.get('/stats', platformStats);
router.get('/online', listOnlineUsers);
router.get('/users', listUsers);
router.patch('/users/:id/toggle-active', toggleUserActive);
router.patch('/users/:id/plan', updateUserPlan);
router.post('/users/:id/balance', adjustBalance);
router.get('/withdrawals', listWithdrawals);
router.patch('/withdrawals/:id/status', updateWithdrawalStatus);
router.post('/withdrawals/payout-batch', triggerPayoutBatch);
router.post('/withdrawals/:id/payout', triggerPayout);
router.get('/audit-logs', listAuditLogs);
router.get('/tasks', listTasks);
router.post('/tasks', createTask);
router.post('/tasks/bulk', bulkImportTasks);
router.patch('/tasks/:id', updateTask);
router.post('/broadcast', broadcastEmail);
router.get('/revenue', revenueStats);
router.post('/leaderboard-rewards', grantLeaderboardRewards);

export default router;
