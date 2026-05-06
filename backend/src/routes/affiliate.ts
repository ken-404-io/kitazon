import { Router } from 'express';
import authMiddleware from '../middleware/auth';
import { cpalead, lootably, offertoro, adscend, affiliateEarnings } from '../controllers/affiliateController';

const router = Router();

// Postback endpoints — called by affiliate networks (no auth, verified by secret)
router.get('/postback/cpalead', cpalead);
router.get('/postback/lootably', lootably);
router.get('/postback/offertoro', offertoro);
router.get('/postback/adscend', adscend);

// User stats
router.get('/earnings', authMiddleware, affiliateEarnings);

export default router;
