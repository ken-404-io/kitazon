import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';

export async function feed(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payouts = await db('withdrawals')
      .where({ 'withdrawals.status': 'completed' })
      .join('users', 'withdrawals.user_id', 'users.id')
      .select(
        'withdrawals.id',
        'withdrawals.amount',
        'withdrawals.channel',
        'withdrawals.created_at',
        db.raw("CONCAT(LEFT(users.name, 1), REPEAT('*', GREATEST(LENGTH(users.name) - 2, 1)), RIGHT(users.name, 1)) as masked_name")
      )
      .orderBy('withdrawals.created_at', 'desc')
      .limit(50);
    res.json(payouts);
  } catch (err) { next(err); }
}
