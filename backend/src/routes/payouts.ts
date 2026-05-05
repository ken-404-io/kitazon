import { Router } from 'express';
import { feed } from '../controllers/payoutController';

const router = Router();

router.get('/feed', feed);

export default router;
