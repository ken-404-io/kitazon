import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser, WithdrawalChannel } from '../types';
import { createOtp, verifyOtp } from '../services/otp';
import { sendWithdrawalOtp, sendWithdrawalConfirmation } from '../services/email';
import { logAudit } from '../services/audit';

const VALID_CHANNELS: WithdrawalChannel[] = ['gcash', 'maya', 'gotyme', 'bpi', 'bdo', 'unionbank', 'coins', 'usdt'];
const ACCOUNT_PATTERN = /^[a-zA-Z0-9\-\s]{5,50}$/;
const ACCOUNT_CHANGE_COOLDOWN_MS = 48 * 60 * 60 * 1000;

function maskAccount(account: string): string {
  if (account.length <= 4) return '****';
  return '*'.repeat(account.length - 4) + account.slice(-4);
}

interface SuspiciousFlags {
  flags: string[];
  isSuspicious: boolean;
}

async function detectSuspicious(userId: number, amount: number, user: DbUser): Promise<SuspiciousFlags> {
  const flags: string[] = [];
  const now = new Date();

  // Flag: account created less than 24h ago
  const ageHours = (now.getTime() - new Date(user.created_at).getTime()) / 3_600_000;
  if (ageHours < 24) flags.push('account_age_lt_24h');

  // Flag: withdrawal > 80% of balance
  if (amount > Number(user.balance) * 0.8) flags.push('high_balance_percentage');

  // Flag: more than 2 withdrawals in last 24h
  const recentCount = await db('withdrawals')
    .where({ user_id: userId })
    .where('created_at', '>', new Date(now.getTime() - 24 * 3_600_000))
    .count('id as cnt')
    .first();
  if (Number(recentCount?.cnt ?? 0) >= 2) flags.push('multiple_withdrawals_24h');

  return { flags, isSuspicious: flags.length > 0 };
}

export async function requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount } = req.body as { amount: string | number };
    const parsed = parseFloat(String(amount));
    if (!parsed || isNaN(parsed) || parsed < 50) {
      res.status(400).json({ message: 'Minimum withdrawal is ₱50.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    if (!user.email_verified) {
      res.status(403).json({ message: 'Please verify your email before making withdrawals.' });
      return;
    }

    const otp = await createOtp(user.id, 'withdrawal_otp', 10);
    await sendWithdrawalOtp(user.email, user.name, otp, parsed);
    res.json({ message: 'OTP sent to your email address.' });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, channel, account_number, otp } = req.body as {
      amount: string | number; channel: string; account_number: string; otp: string;
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
    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      res.status(400).json({ message: 'A 6-digit OTP is required.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    if (!user.email_verified) {
      res.status(403).json({ message: 'Please verify your email before making withdrawals.' });
      return;
    }

    // Verify OTP
    const otpValid = await verifyOtp(user.id, otp.trim(), 'withdrawal_otp');
    if (!otpValid) {
      res.status(400).json({ message: 'Invalid or expired OTP.' });
      return;
    }

    // Account number change cooldown (48h)
    if (user.last_withdrawal_account && user.last_withdrawal_account !== account_number) {
      const changedAt = user.last_withdrawal_account_changed_at;
      if (changedAt && Date.now() - new Date(changedAt).getTime() < ACCOUNT_CHANGE_COOLDOWN_MS) {
        const hoursLeft = Math.ceil((ACCOUNT_CHANGE_COOLDOWN_MS - (Date.now() - new Date(changedAt).getTime())) / 3_600_000);
        res.status(400).json({ message: `Account number was recently changed. Please wait ${hoursLeft} more hour(s).` });
        return;
      }
    }

    // Suspicious activity detection
    const { flags, isSuspicious } = await detectSuspicious(user.id, parsed, user);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthTotal] = await db('withdrawals')
      .where({ user_id: req.user!.id, status: 'completed' })
      .where('created_at', '>=', monthStart)
      .sum('amount as total');

    const cumulative = parseFloat(String(monthTotal?.total ?? 0));
    const fee = cumulative >= 500 ? 5 : 0;
    const netAmount = parseFloat((parsed - fee).toFixed(2));
    if (netAmount <= 0) { res.status(400).json({ message: 'Amount too low after fee deduction.' }); return; }

    let insufficientBalance = false;
    const accountChanged = user.last_withdrawal_account !== account_number;

    await db.transaction(async (trx) => {
      const updated = await trx('users')
        .where({ id: req.user!.id })
        .where('balance', '>=', parsed)
        .decrement('balance', parsed);
      if (updated === 0) { insufficientBalance = true; return; }

      await trx('withdrawals').insert({
        user_id: req.user!.id, amount: parsed, fee, net_amount: netAmount,
        channel, account_number, status: 'pending',
      });

      if (accountChanged) {
        await trx('users').where({ id: req.user!.id }).update({
          last_withdrawal_account: account_number,
          last_withdrawal_account_changed_at: new Date(),
        });
      }
    });

    if (insufficientBalance) { res.status(400).json({ message: 'Insufficient balance.' }); return; }

    await logAudit(req.user!.id, 'withdrawal_create', req, {
      amount: parsed,
      metadata: { channel, isSuspicious, flags },
    });

    // Send confirmation email (fire-and-forget)
    sendWithdrawalConfirmation(user.email, user.name, netAmount, channel).catch(() => {});

    res.status(201).json({
      message: 'Withdrawal submitted successfully.',
      fee,
      net_amount: netAmount,
      ...(isSuspicious ? { notice: 'Your withdrawal is under review due to unusual activity.' } : {}),
    });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ message: 'Invalid ID.' }); return; }
    const w = await db('withdrawals').where({ id, user_id: req.user!.id }).first();
    if (!w) { res.status(404).json({ message: 'Withdrawal not found.' }); return; }
    res.json(w);
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const withdrawals = await db('withdrawals')
      .where({ user_id: req.user!.id })
      .orderBy('created_at', 'desc')
      .select('id', 'amount', 'fee', 'net_amount', 'channel', 'account_number', 'status', 'created_at');

    const masked = withdrawals.map((w) => ({ ...w, account_number: maskAccount(String(w.account_number)) }));
    res.json(masked);
  } catch (err) { next(err); }
}
