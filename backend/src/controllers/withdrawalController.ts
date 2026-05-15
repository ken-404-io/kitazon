import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db from '../../config/database';
import { DbUser, DbOtpToken, WithdrawalChannel } from '../types';
import { createOtp } from '../services/otp';
import { sendWithdrawalOtp, sendWithdrawalSubmittedEmail, sendSuspiciousWithdrawalEmail } from '../services/email';
import { logAudit } from '../services/audit';

const VALID_CHANNELS: WithdrawalChannel[] = ['gcash'];
// Philippine mobile number: 11 digits starting with 09 (e.g. 09171234567)
// Also accept +63 prefix form (e.g. +639171234567)
const ACCOUNT_PATTERN = /^(09\d{9}|\+639\d{9})$/;
const QUIZ_GATE_REQUIRED = 20;

function normalizeGcashNumber(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+63') && digits.length === 13) return '0' + digits.slice(3);
  return digits;
}

// Count correct quiz answers since the user's most recent withdrawal (any status).
// First-ever withdrawal counts all-time correct quiz answers.
async function countQuizzesSinceLastWithdrawal(userId: number): Promise<number> {
  const lastWithdrawal = await db('withdrawals')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .select('created_at')
    .first();

  let q = db('earnings').where({ user_id: userId, type: 'quiz' });
  if (lastWithdrawal) q = q.where('created_at', '>', lastWithdrawal.created_at);
  const row = await q.count('id as n').first();
  return Number((row as { n?: unknown } | undefined)?.n ?? 0);
}

// ─── Shared eligibility helper ────────────────────────────────────────────────
async function getWithdrawalEligibility(userId: number, user: DbUser) {
  const prevWithdrawal = await db('withdrawals').where({ user_id: userId }).first();
  const isFirstWithdrawal = !prevWithdrawal;

  const quizzesCompleted = await countQuizzesSinceLastWithdrawal(userId);

  const reasons: string[] = [];
  if (!user.email_verified) reasons.push('email_not_verified');
  if (quizzesCompleted < QUIZ_GATE_REQUIRED) reasons.push('quiz_gate_not_met');

  return {
    eligible: reasons.length === 0,
    email_verified: user.email_verified,
    is_first_withdrawal: isFirstWithdrawal,
    withdrawal_credits: Number(user.withdrawal_credits ?? 0),
    quizzes_completed: quizzesCompleted,
    quizzes_required: QUIZ_GATE_REQUIRED,
    reasons,
  };
}


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

export async function eligibility(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    res.json(await getWithdrawalEligibility(user.id, user));
  } catch (err) { next(err); }
}

export async function savedAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Ignore withdrawals from before the user cleared their saved payment method
    let clearedAt: Date | null = null;
    try {
      const u = await db<DbUser>('users').where({ id: req.user!.id }).select('payment_method_cleared_at').first();
      clearedAt = (u?.payment_method_cleared_at as Date | null | undefined) ?? null;
    } catch { /* column not migrated yet */ }

    let q = db('withdrawals').where({ user_id: req.user!.id });
    if (clearedAt) q = q.where('created_at', '>', clearedAt);

    const last = await q.orderBy('created_at', 'desc').select('account_number', 'channel').first();
    res.json(last ? { account_number: last.account_number, channel: last.channel } : null);
  } catch (err) { next(err); }
}

export async function clearPaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Block if there's a pending or processing withdrawal — must settle first
    const hasPending = await db('withdrawals')
      .where({ user_id: req.user!.id })
      .whereIn('status', ['pending', 'processing'])
      .first();
    if (hasPending) {
      res.status(400).json({ message: 'You have a withdrawal in progress. Wait for it to be processed before changing your payment method.' });
      return;
    }

    try {
      await db('users').where({ id: req.user!.id }).update({ payment_method_cleared_at: new Date() });
    } catch (err) {
      // Column not yet migrated
      console.error('[clearPaymentMethod] update failed (is migration 021 applied?):', err);
      res.status(503).json({ message: 'Payment method removal is not available yet. Please contact support.' });
      return;
    }

    await logAudit(req.user!.id, 'payment_method_cleared', req, {});
    res.json({ message: 'Payment method removed. You can register a new GCash number on your next withdrawal.' });
  } catch (err) { next(err); }
}

export async function requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount } = req.body as { amount: string | number };
    const parsed = parseFloat(String(amount));
    if (!parsed || isNaN(parsed) || parsed < 5) {
      res.status(400).json({ message: 'Minimum withdrawal is ₱5.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    if (!user.email_verified) {
      res.status(403).json({ message: 'Please verify your email before making withdrawals.' });
      return;
    }

    const elig = await getWithdrawalEligibility(user.id, user);
    if (!elig.eligible) {
      if (elig.reasons.includes('quiz_gate_not_met')) {
        res.status(403).json({
          message: `Answer ${elig.quizzes_required} math quiz questions before requesting a withdrawal. You have completed ${elig.quizzes_completed}/${elig.quizzes_required}.`,
          reason: 'quiz_gate_not_met',
          quizzes_completed: elig.quizzes_completed,
          quizzes_required: elig.quizzes_required,
        });
        return;
      }
      res.status(403).json({ message: 'Please verify your email before making withdrawals.' });
      return;
    }

    // Credits pre-check so user gets feedback before receiving OTP
    const userCredits = Number(user.withdrawal_credits ?? 0);
    const creditsNeeded = Math.ceil(parsed);
    if (userCredits < creditsNeeded) {
      res.status(403).json({
        message: `You need ${creditsNeeded} withdrawal credits to withdraw ₱${parsed}. You have ${userCredits} credits.`,
        reason: 'insufficient_credits',
        credits_available: userCredits,
        credits_needed: creditsNeeded,
      });
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

    if (!parsed || isNaN(parsed) || parsed < 5) {
      res.status(400).json({ message: 'Minimum withdrawal is ₱5.' });
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
    const normalizedAccount = account_number ? normalizeGcashNumber(account_number) : '';
    if (!normalizedAccount || !ACCOUNT_PATTERN.test(normalizedAccount)) {
      res.status(400).json({ message: 'Invalid GCash mobile number. Use 11 digits starting with 09 (e.g. 09171234567).' });
      return;
    }
    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      res.status(400).json({ message: 'A 6-digit OTP is required.' });
      return;
    }

    // GCash account uniqueness: one GCash per user, not shared across accounts.
    // BUT: if the conflicting owner has removed their saved payment method
    // (payment_method_cleared_at IS set and >= the conflicting withdrawal's date),
    // the email is considered free again and we ignore that row.
    let takenBy: { id: number } | undefined;
    try {
      takenBy = await db('withdrawals as w')
        .leftJoin('users as u', 'w.user_id', 'u.id')
        .where('w.account_number', normalizedAccount)
        .whereNot({ 'w.user_id': req.user!.id })
        .where((b) => {
          b.whereNull('u.payment_method_cleared_at')
           .orWhereRaw('u.payment_method_cleared_at < w.created_at');
        })
        .select('w.id')
        .first();
    } catch {
      // payment_method_cleared_at column not migrated — fall back to the strict check
      takenBy = await db('withdrawals')
        .where('account_number', normalizedAccount)
        .whereNot({ user_id: req.user!.id })
        .select('id')
        .first();
    }
    if (takenBy) {
      res.status(409).json({ message: 'This GCash number is already registered to another account. Each GCash number can only be linked to one Kitazon account.' });
      return;
    }

    // Also block if this user's own previous GCash number doesn't match (enforce 1 GCash per user).
    // Withdrawals from before payment_method_cleared_at are ignored — the user explicitly
    // removed their saved method and is starting fresh.
    let clearedAt: Date | null = null;
    try {
      const u = await db<DbUser>('users').where({ id: req.user!.id }).select('payment_method_cleared_at').first();
      clearedAt = (u?.payment_method_cleared_at as Date | null | undefined) ?? null;
    } catch { /* column not migrated yet */ }

    let ownPreviousQuery = db('withdrawals')
      .where({ user_id: req.user!.id })
      .whereNot('account_number', normalizedAccount);
    if (clearedAt) ownPreviousQuery = ownPreviousQuery.where('created_at', '>', clearedAt);
    const ownPrevious = await ownPreviousQuery.first();
    if (ownPrevious) {
      res.status(409).json({
        message: `You have already linked GCash number "${maskAccount(ownPrevious.account_number)}" to your Kitazon account. Only one GCash number is allowed per user.`,
        reason: 'gcash_locked',
        saved_account: ownPrevious.account_number,
      });
      return;
    }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    if (!user.email_verified) {
      res.status(403).json({ message: 'Please verify your email before making withdrawals.' });
      return;
    }

    const elig = await getWithdrawalEligibility(user.id, user);
    if (!elig.eligible) {
      if (elig.reasons.includes('quiz_gate_not_met')) {
        res.status(403).json({
          message: `Answer ${elig.quizzes_required} math quiz questions before requesting a withdrawal. You have completed ${elig.quizzes_completed}/${elig.quizzes_required}.`,
          reason: 'quiz_gate_not_met',
          quizzes_completed: elig.quizzes_completed,
          quizzes_required: elig.quizzes_required,
        });
        return;
      }
      res.status(403).json({ message: 'Please verify your email before making withdrawals.' });
      return;
    }

    // Withdrawal credits check: need 1 credit per ₱1 withdrawn
    const userCredits = Number(user.withdrawal_credits ?? 0);
    const creditsNeeded = Math.ceil(parsed);
    if (userCredits < creditsNeeded) {
      res.status(403).json({
        message: `You need ${creditsNeeded} withdrawal credits to withdraw ₱${parsed}. You have ${userCredits} credits.`,
        reason: 'insufficient_credits',
        credits_available: userCredits,
        credits_needed: creditsNeeded,
      });
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
    const { flags: baseFlags, isSuspicious: baseSuspicious } = await detectSuspicious(user.id, parsed, user);
    const flags = [...baseFlags];
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';

    // Check 1: multiple withdrawals from same IP in last hour (other accounts)
    try {
      const recentSameIp = await db('withdrawals')
        .where('created_at', '>', new Date(Date.now() - 60 * 60 * 1000))
        .whereRaw('ip_address = ?', [ip])
        .whereNot({ user_id: req.user!.id })
        .count('id as cnt').first();
      if (Number((recentSameIp as any)?.cnt) >= 3) flags.push('multiple_accounts_same_ip');
    } catch { /* ip_address column not yet migrated — skip */ }

    // Check 2: withdrawal within 10 minutes of account creation
    const accountAge = Date.now() - new Date(user.created_at).getTime();
    if (accountAge < 10 * 60 * 1000) flags.push('new_account');

    // Check 3: more than 3 withdrawals today
    const todayWithdrawals = await db('withdrawals')
      .where({ user_id: req.user!.id })
      .where('created_at', '>', new Date(new Date().setHours(0, 0, 0, 0)))
      .count('id as cnt').first();
    if (Number((todayWithdrawals as any)?.cnt) >= 3) flags.push('excessive_daily_withdrawals');

    const isSuspicious = flags.length > 0;
    if (flags.length > 0) {
      console.warn(`[FRAUD] user=${req.user!.id} ip=${ip} flags=${flags.join(',')}`);
    }

    // Hard block: same IP used by multiple accounts recently
    if (flags.includes('multiple_accounts_same_ip')) {
      res.status(403).json({ message: 'This network connection has been used by multiple accounts recently. Withdrawal blocked for security.' });
      return;
    }

    // Hard block: account created less than 10 minutes ago
    if (flags.includes('new_account')) {
      res.status(403).json({ message: 'New accounts must wait at least 10 minutes before making a withdrawal.' });
      return;
    }

    // Hard block: too many withdrawals today
    if (flags.includes('excessive_daily_withdrawals')) {
      res.status(403).json({ message: 'You have reached the maximum number of withdrawals for today. Please try again tomorrow.' });
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
        .whereRaw('COALESCE(withdrawal_credits, 0) >= ?', [creditsNeeded])
        .decrement('balance', parsed);
      if (updated === 0) { insufficientBalance = true; return; }

      // Deduct credits (1 per ₱1 withdrawn) — savepoint so failure doesn't abort the transaction
      await trx.raw('SAVEPOINT sp_credits');
      try {
        await trx('users').where({ id: req.user!.id }).decrement('withdrawal_credits', creditsNeeded);
        await trx.raw('RELEASE SAVEPOINT sp_credits');
      } catch {
        await trx.raw('ROLLBACK TO SAVEPOINT sp_credits');
      }

      // Insert withdrawal — try with optional columns, fall back to minimal set via savepoint
      await trx.raw('SAVEPOINT sp_withdrawal');
      try {
        await trx('withdrawals').insert({
          user_id: req.user!.id, amount: parsed, fee, net_amount: netAmount,
          channel, account_number: normalizedAccount, status: 'pending',
          ip_address: ip || null,
          is_flagged: isSuspicious,
          is_first_withdrawal: elig.is_first_withdrawal,
          metadata: JSON.stringify({ flags: flags.length > 0 ? flags : undefined, is_first: elig.is_first_withdrawal }),
        });
        await trx.raw('RELEASE SAVEPOINT sp_withdrawal');
      } catch {
        await trx.raw('ROLLBACK TO SAVEPOINT sp_withdrawal');
        await trx('withdrawals').insert({
          user_id: req.user!.id, amount: parsed, fee, net_amount: netAmount,
          channel, account_number: normalizedAccount, status: 'pending',
        });
      }
    });

    if (otpInvalid)         { res.status(400).json({ message: 'Invalid or expired OTP.' }); return; }
    if (insufficientBalance){ res.status(400).json({ message: 'Insufficient balance.' }); return; }

    await logAudit(req.user!.id, 'withdrawal_create', req, {
      amount: parsed,
      metadata: { channel, isSuspicious, flags },
    });

    sendWithdrawalSubmittedEmail(user.email, user.name, parsed, channel, netAmount, fee).catch(() => {});
    if (isSuspicious) sendSuspiciousWithdrawalEmail(user.email, user.name, parsed, flags).catch(() => {});

    const flagNotices: Record<string, string> = {
      account_age_lt_24h:       'Your account is less than 24 hours old — this withdrawal is under manual review.',
      high_balance_percentage:  'You are withdrawing a large portion of your balance — this withdrawal is under review.',
      multiple_withdrawals_24h: 'Multiple withdrawals detected in the last 24 hours — this withdrawal is under review.',
    };
    const notice = flags.map(f => flagNotices[f]).find(Boolean) ?? (isSuspicious ? 'Your withdrawal is under review due to unusual activity.' : undefined);

    res.status(201).json({
      message: 'Withdrawal submitted successfully.',
      fee,
      net_amount: netAmount,
      ...(notice ? { notice } : {}),
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
