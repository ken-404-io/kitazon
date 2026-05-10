import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser } from '../types';
import { logAudit } from '../services/audit';

/* ── GET /api/credits ──────────────────────────────────────────────────────── */
export async function getCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    res.json({ credits: Number(user.withdrawal_credits ?? 0) });
  } catch (err) { next(err); }
}

/* ── POST /api/credits/convert ─────────────────────────────────────────────── */
// Convert PHP balance → withdrawal credits at 1:1
export async function convertToCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount } = req.body as { amount: string | number };
    const parsed = Math.floor(Number(amount)); // credits are whole numbers

    if (!parsed || isNaN(parsed) || parsed < 1) {
      res.status(400).json({ message: 'Minimum conversion is ₱1 (= 1 credit).' });
      return;
    }
    if (parsed > 10000) {
      res.status(400).json({ message: 'Maximum conversion is ₱10,000 at a time.' });
      return;
    }

    let insufficientBalance = false;

    await db.transaction(async (trx) => {
      const updated = await trx('users')
        .where({ id: req.user!.id })
        .whereRaw('balance >= ?', [parsed])
        .decrement('balance', parsed);

      if (updated === 0) { insufficientBalance = true; return; }

      try {
        await trx('users')
          .where({ id: req.user!.id })
          .increment('withdrawal_credits', parsed);
      } catch {
        // column may not exist yet — silently skip so PHP deduction still rolls back
        throw new Error('withdrawal_credits column missing — run migration');
      }
    });

    if (insufficientBalance) {
      res.status(400).json({ message: 'Insufficient balance.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    await logAudit(req.user!.id, 'credits_convert', req, { metadata: { amount: parsed } });

    res.json({
      message: `Converted ₱${parsed} → ${parsed} withdrawal credits.`,
      credits: Number(user?.withdrawal_credits ?? 0),
      balance: Number(user?.balance ?? 0),
    });
  } catch (err) { next(err); }
}
