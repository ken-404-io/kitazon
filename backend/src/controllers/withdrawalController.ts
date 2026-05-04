import { Response, NextFunction } from 'express';
import db from '../../config/database';
import { AuthRequest, WithdrawalChannel } from '../types';

const VALID_CHANNELS: WithdrawalChannel[] = ['gcash', 'maya', 'gotyme', 'bpi', 'bdo', 'unionbank', 'coins', 'usdt'];

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, channel, account_number } = req.body as {
      amount: string | number; channel: string; account_number: string;
    };
    const parsed = parseFloat(String(amount));

    if (!parsed || parsed < 50) {
      res.status(400).json({ message: 'Minimum withdrawal is ₱50.' });
      return;
    }
    if (!VALID_CHANNELS.includes(channel as WithdrawalChannel)) {
      res.status(400).json({ message: 'Invalid payment channel.' });
      return;
    }
    if (!account_number) {
      res.status(400).json({ message: 'Account number is required.' });
      return;
    }

    const user = await db('users').where({ id: req.user.id }).first();
    if (user.balance < parsed) {
      res.status(400).json({ message: 'Insufficient balance.' });
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthTotal] = await db('withdrawals')
      .where({ user_id: req.user.id, status: 'completed' })
      .where('created_at', '>=', monthStart)
      .sum('amount as total');

    const cumulative = parseFloat(String(monthTotal?.total ?? 0));
    const fee = cumulative >= 500 ? 5 : 0;
    const netAmount = parsed - fee;

    if (netAmount <= 0) {
      res.status(400).json({ message: 'Amount too low after fee deduction.' });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('users').where({ id: req.user.id }).decrement('balance', parsed);
      await trx('withdrawals').insert({ user_id: req.user.id, amount: parsed, fee, net_amount: netAmount, channel, account_number, status: 'pending' });
    });

    res.status(201).json({ message: 'Withdrawal submitted successfully.', fee, net_amount: netAmount });
  } catch (err) { next(err); }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const withdrawals = await db('withdrawals').where({ user_id: req.user.id }).orderBy('created_at', 'desc');
    res.json(withdrawals);
  } catch (err) { next(err); }
}
