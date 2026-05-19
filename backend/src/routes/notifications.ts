import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { listNotifications, markAllRead } from '../controllers/notificationsController';

const router = Router();

router.use(authMiddleware);

router.get('/', listNotifications);
router.post('/read-all', markAllRead);

export default router;
