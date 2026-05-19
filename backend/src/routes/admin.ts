import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import adminAuth from '../middleware/adminAuth';
import { platformStats, listUsers, toggleUserActive, toggleUserAdmin, listWithdrawals, updateWithdrawalStatus, listAuditLogs, getUserAuditLogs, listTasks, createTask, updateTask, updateUserPlan, adjustBalance, broadcastEmail, revenueStats, bulkImportTasks, grantLeaderboardRewards, listOnlineUsers, bulkApproveWithdrawals, listGcashPayments, approveGcashPayment, rejectGcashPayment, setReferralCount, fraudReport, suspendAllFraud } from '../controllers/adminController';
import { getPublicSettings, adminUpdateSettings } from '../controllers/settingsController';

const router = Router();

router.use(authMiddleware, adminAuth);

router.get('/stats', platformStats);
router.get('/online', listOnlineUsers);
router.get('/users', listUsers);
router.patch('/users/:id/toggle-active', toggleUserActive);
router.get('/users/:id/audit-logs', getUserAuditLogs);
router.patch('/users/:id/toggle-admin', toggleUserAdmin);
router.patch('/users/:id/plan', updateUserPlan);
router.post('/users/:id/referrals', setReferralCount);
router.post('/users/:id/balance', adjustBalance);
router.get('/withdrawals', listWithdrawals);
router.patch('/withdrawals/:id/status', updateWithdrawalStatus);
router.post('/withdrawals/bulk-approve', bulkApproveWithdrawals);
router.get('/audit-logs', listAuditLogs);
router.get('/tasks', listTasks);
router.post('/tasks', createTask);
router.post('/tasks/bulk', bulkImportTasks);
router.patch('/tasks/:id', updateTask);
router.post('/broadcast', broadcastEmail);
router.get('/revenue', revenueStats);
router.post('/leaderboard-rewards', grantLeaderboardRewards);
router.get('/gcash-payments', listGcashPayments);
router.patch('/gcash-payments/:id/approve', approveGcashPayment);
router.patch('/gcash-payments/:id/reject', rejectGcashPayment);
router.get('/fraud', fraudReport);
router.post('/fraud/suspend-all', suspendAllFraud);
router.get('/settings', getPublicSettings);
router.put('/settings', adminUpdateSettings);

export default router;
