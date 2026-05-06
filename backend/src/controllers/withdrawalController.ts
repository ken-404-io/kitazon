import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { WithdrawalChannel } from '../types';

const VALID_CHANNELS: WithdrawalChannel[] = ['gcash', 'maya', 'gotyme', 'bpi', 'bdo', 'unionbank', 'coins', 'usdt'];
const ACCOUNT_PATTERN = /^[a-zA-Z0-9\-\s]{5,50}$/;

function maskAccount(account: string): string {
  if (account.length <= 4) return '****';
  return '*'.repeat(account.length - 4) + account.slice(-4);
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, channel, account_number } = req.body as {
      amount: string | number; channel: string; account_number: string;
    };
    const parsed = parseFloat(String(amount));

    if (!parsed || isNaN(parsed) || parsed < 50) {
      res.status(400).json({ message: 'Minimum withdrawal is ₱50.' });
      return;
    }
    if (parsed > 50000) {
      res.status(400).json({ message: 'Maximum withdrawal is ₱50,000 per transaction.' });
      return;
    }
    if (!VALID_CHANNELS.includes(channel as WithdrawalChannel)) {
      res.status(400).json({ message: 'Invalid payment channel.' });
      return;
    }
    if (!account_number || !ACCOUNT_PATTERN.test(account_number)) {
      res.status(400).json({ message: 'Invalid account number format.' });
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthTotal] = await db('withdrawals')
      .where({ user_id: req.user!.id, status: 'completed' })
      .where('created_at', '>=', monthStart)
      .sum('amount as total');

    const cumulative = parseFloat(String(monthTotal?.total ?? 0));
    const fee = cumulative >= 500 ? 5 : 0;
    const netAmount = parseFloat((parsed - fee).toFixed(2));

    if (netAmount <= 0) {
      res.status(400).json({ message: 'Amount too low after fee deduction.' });
      return;
    }

    let insufficientBalance = false;
    await db.transaction(async (trx) => {
      // Atomic balance check + decrement — prevents negative balance race condition
      const updated = await trx('users')
        .where({ id: req.user!.id })
        .where('balance', '>=', parsed)
        .decrement('balance', parsed);

      if (updated === 0) {
        insufficientBalance = true;
        return;
      }

      await trx('withdrawals').insert({
        user_id: req.user!.id,
        amount: parsed,
        fee,
        net_amount: netAmount,
        channel,
        account_number,
        status: 'pending',
      });
    });

    if (insufficientBalance) {
      res.status(400).json({ message: 'Insufficient balance.' });
      return;
    }

    res.status(201).json({ message: 'Withdrawal submitted successfully.', fee, net_amount: netAmount });
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const withdrawals = await db('withdrawals')
      .where({ user_id: req.user!.id })
      .orderBy('created_at', 'desc')
      .select('id', 'amount', 'fee', 'net_amount', 'channel', 'account_number', 'status', 'created_at');

    // Mask account numbers before sending to client
    const masked = withdrawals.map((w) => ({
      ...w,
      account_number: maskAccount(String(w.account_number)),
    }));

    res.json(masked);
  } catch (err) { next(err); }
}
