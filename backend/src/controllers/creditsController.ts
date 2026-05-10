import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser } from '../types';
import { logAudit } from '../services/audit';

const PHP_PER_CREDIT = 25; // ₱25 = 1 withdrawal credit

/* ── GET /api/credits ──────────────────────────────────────────────────────── */
export async function getCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    res.json({ credits: Number(user.withdrawal_credits ?? 0), php_per_credit: PHP_PER_CREDIT });
  } catch (err) { next(err); }
}

/* ── POST /api/credits/convert ─────────────────────────────────────────────── */
// Convert PHP balance → withdrawal credits at ₱25 per credit
export async function convertToCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount } = req.body as { amount: string | number };
    const parsed = Math.floor(Number(amount)); // PHP amount to spend

    if (!parsed || isNaN(parsed) || parsed < PHP_PER_CREDIT) {
      res.status(400).json({ message: `Minimum conversion is ₱${PHP_PER_CREDIT} (= 1 credit).` });
      return;
    }
    if (parsed > 10000) {
      res.status(400).json({ message: 'Maximum conversion is ₱10,000 at a time.' });
      return;
    }

    // Only accept multiples of PHP_PER_CREDIT so no fractional credits
    const creditsToGrant = Math.floor(parsed / PHP_PER_CREDIT);
    const phpToDeduct    = creditsToGrant * PHP_PER_CREDIT;

    let insufficientBalance = false;

    await db.transaction(async (trx) => {
      const updated = await trx('users')
        .where({ id: req.user!.id })
        .whereRaw('balance >= ?', [phpToDeduct])
        .decrement('balance', phpToDeduct);

      if (updated === 0) { insufficientBalance = true; return; }

      try {
        await trx('users')
          .where({ id: req.user!.id })
          .increment('withdrawal_credits', creditsToGrant);
      } catch {
        throw new Error('withdrawal_credits column missing — run migration');
      }
    });

    if (insufficientBalance) {
      res.status(400).json({ message: 'Insufficient balance.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    await logAudit(req.user!.id, 'credits_convert', req, { metadata: { php_spent: phpToDeduct, credits_granted: creditsToGrant } });

    res.json({
      message: `Converted ₱${phpToDeduct} → ${creditsToGrant} withdrawal credit${creditsToGrant !== 1 ? 's' : ''}.`,
      credits: Number(user?.withdrawal_credits ?? 0),
      balance: Number(user?.balance ?? 0),
    });
  } catch (err) { next(err); }
}
