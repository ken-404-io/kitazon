import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db from '../../config/database';
import { DbUser, DbOtpToken, WithdrawalChannel } from '../types';
import { createOtp } from '../services/otp';
import { sendWithdrawalOtp, sendWithdrawalSubmittedEmail, sendSuspiciousWithdrawalEmail } from '../services/email';
import { logAudit } from '../services/audit';

const VALID_CHANNELS: WithdrawalChannel[] = ['paypal'];
const ACCOUNT_PATTERN = /^[a-zA-Z0-9@.\-\s]{5,60}$/;


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

    // Block if user already has a pending or processing withdrawal
    const hasPending = await db('withdrawals')
      .where({ user_id: req.user!.id })
      .whereIn('status', ['pending', 'processing'])
      .first();
    if (hasPending) {
      res.status(400).json({ message: 'You have a withdrawal in progress. Wait for it to be processed before submitting another.' });
      return;
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
    let otpInvalid = false;

    const otpHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');

    await db.transaction(async (trx) => {
      // Inline OTP verification using trx — avoids acquiring a second DB connection
      const otpRecord = await trx<DbOtpToken>('otp_tokens')
        .where({ user_id: user.id, token_hash: otpHash, purpose: 'withdrawal_otp' })
        .whereNull('used_at')
        .where('expires_at', '>', new Date())
        .first();
      if (!otpRecord) { otpInvalid = true; return; }
      await trx('otp_tokens').where({ id: otpRecord.id }).update({ used_at: new Date() });

      const updated = await trx('users')
        .where({ id: req.user!.id })
        .where('balance', '>=', parsed)
        .decrement('balance', parsed);
      if (updated === 0) { insufficientBalance = true; return; }

      await trx('withdrawals').insert({
        user_id: req.user!.id, amount: parsed, fee, net_amount: netAmount,
        channel, account_number, status: 'pending',
      });
    });

    if (otpInvalid)         { res.status(400).json({ message: 'Invalid or expired OTP.' }); return; }
    if (insufficientBalance){ res.status(400).json({ message: 'Insufficient balance.' }); return; }

    await logAudit(req.user!.id, 'withdrawal_create', req, {
      amount: parsed,
      metadata: { channel, isSuspicious, flags },
    });

    sendWithdrawalSubmittedEmail(user.email, user.name, parsed, channel, netAmount, fee).catch(() => {});
    if (isSuspicious) sendSuspiciousWithdrawalEmail(user.email, user.name, parsed, flags).catch(() => {});

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
