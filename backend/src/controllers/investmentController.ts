import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import db from '../../config/database';
import { DbUser } from '../types';
import { logAudit } from '../services/audit';
import { getAllSettings } from './settingsController';
import {
  sendKitaGrowInvestmentNotificationEmail,
  sendKitaGrowInvestmentReceivedEmail,
  sendKitaGrowInvestmentActivatedEmail,
  sendKitaGrowInvestmentRejectedEmail,
} from '../services/email';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Investment term (days) → payout multiplier. The product definition: a fixed
// payout multiple of the principal at the end of the term.
const TERMS: Record<number, number> = { 30: 1.2, 60: 1.6, 120: 3.0 };
const KG_WITHDRAW_MIN = 100;

const GCASH_PATTERN = /^(09\d{9}|\+639\d{9})$/;

function normalizeGcash(raw: string): string {
  const digits = (raw ?? '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+63') && digits.length === 13) return '0' + digits.slice(3);
  return digits;
}

function validateAccountName(raw: string): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'GCash account name is required.';
  if (trimmed.length < 2 || trimmed.length > 100) return 'GCash account name must be 2–100 characters.';
  if (/\S+@\S+\.\S+/.test(trimmed)) return 'Account name cannot be an email address.';
  return null;
}

function termsResponse() {
  return Object.entries(TERMS).map(([days, mult]) => ({
    term_days: Number(days),
    multiplier: mult,
    return_pct: Math.round((mult - 1) * 100),
  }));
}

async function getConfig() {
  const s = await getAllSettings().catch(() => ({} as Record<string, string>));
  return {
    min: Number(s['kitagrow_min'] ?? 500),
    max: Number(s['kitagrow_max'] ?? 50000),
    enabled: (s['kitagrow_enabled'] ?? 'true') !== 'false',
    gcash_number: s['kitagrow_gcash_number'] || s['gcash_number'] || '',
    gcash_name: s['kitagrow_gcash_name'] || s['gcash_name'] || 'Kitazon',
    gcash_qr: s['kitagrow_gcash_qr'] || '',
  };
}

// Lazily credit any matured investments to the user's KitaGrow wallet.
// Runs on every overview/withdraw request, so payouts settle without a cron.
async function settleMatured(userId: number): Promise<void> {
  const due = await db('investments')
    .where({ user_id: userId, status: 'active' })
    .where('matures_at', '<=', new Date())
    .select('id', 'payout_amount');

  for (const inv of due) {
    try {
      await db.transaction(async (trx) => {
        // Guard against double-credit: only settle a row still marked active.
        const updated = await trx('investments')
          .where({ id: inv.id, status: 'active' })
          .update({ status: 'matured', paid_out_at: new Date(), updated_at: new Date() });
        if (updated === 0) return;
        await trx('users').where({ id: userId }).increment('kitagrow_balance', Number(inv.payout_amount));
      });
    } catch (err) {
      console.error('[KitaGrow] maturity settlement failed for investment', inv.id, err);
    }
  }
}

/* ── GET /api/investments ──────────────────────────────────────────────────── */
export async function getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await settleMatured(req.user!.id);

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const investments = await db('investments')
      .where({ user_id: req.user!.id })
      .orderBy('created_at', 'desc')
      .select('id', 'term_days', 'amount', 'payout_amount', 'reference', 'status',
        'admin_note', 'activated_at', 'matures_at', 'paid_out_at', 'created_at');

    const withdrawals = await db('kitagrow_withdrawals')
      .where({ user_id: req.user!.id })
      .orderBy('created_at', 'desc')
      .select('id', 'amount', 'channel', 'account_number', 'status', 'admin_note', 'created_at');

    const now = Date.now();
    let activePrincipal = 0;
    let expectedPayout = 0;
    let totalEarned = 0;
    let inProgressValue = 0; // current accrued value of all active investments

    // Enrich each investment with how far it has grown so far. `progress_pct` is
    // the share of the term elapsed; `accrued_value` is the principal plus the
    // linearly-accrued portion of the gain — i.e. what the investment is "worth"
    // right now, so the UI can show real progress instead of a flat ₱0.00.
    const enrichedInvestments = investments.map((inv) => {
      const amount = Number(inv.amount);
      const payout = Number(inv.payout_amount);
      let progress = 0;
      let accruedValue = amount;

      if (inv.status === 'active' && inv.activated_at && inv.matures_at) {
        const start = new Date(inv.activated_at).getTime();
        const end = new Date(inv.matures_at).getTime();
        progress = end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 0;
        accruedValue = amount + (payout - amount) * progress;
        activePrincipal += amount;
        expectedPayout += payout;
        inProgressValue += accruedValue;
      } else if (inv.status === 'matured') {
        progress = 1;
        accruedValue = payout;
        totalEarned += payout - amount;
      }

      return {
        ...inv,
        progress_pct: Math.round(progress * 100),
        accrued_value: Math.round(accruedValue * 100) / 100,
      };
    });

    res.json({
      wallet_balance: Number(user.kitagrow_balance ?? 0),
      config: await getConfig(),
      terms: termsResponse(),
      withdraw_min: KG_WITHDRAW_MIN,
      investments: enrichedInvestments,
      withdrawals,
      summary: {
        active_principal: activePrincipal,
        expected_payout: expectedPayout,
        total_earned: totalEarned,
        in_progress_value: Math.round(inProgressValue * 100) / 100,
        accrued_earnings: Math.round((inProgressValue - activePrincipal) * 100) / 100,
      },
    });
  } catch (err) { next(err); }
}

/* ── POST /api/investments ─────────────────────────────────────────────────── */
export async function submitInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { term_days, amount, reference, screenshot_data } = req.body as {
      term_days?: number | string; amount?: number | string; reference?: string; screenshot_data?: string;
    };

    const cfg = await getConfig();
    if (!cfg.enabled) { res.status(403).json({ message: 'KitaGrow is currently unavailable. Please check back soon.' }); return; }

    const term = Number(term_days);
    if (!TERMS[term]) { res.status(400).json({ message: 'Invalid investment term.' }); return; }

    const parsed = Math.round(Number(amount) * 100) / 100;
    if (!parsed || isNaN(parsed) || parsed < cfg.min) {
      res.status(400).json({ message: `Minimum investment is ₱${cfg.min.toLocaleString()}.` });
      return;
    }
    if (parsed > cfg.max) {
      res.status(400).json({ message: `Maximum investment is ₱${cfg.max.toLocaleString()}.` });
      return;
    }

    const ref = typeof reference === 'string' ? reference.trim() : '';
    if (ref.length < 5) { res.status(400).json({ message: 'Please enter a valid GCash reference number (at least 5 characters).' }); return; }

    const payoutAmount = Math.round(parsed * TERMS[term] * 100) / 100;

    let screenshotUrl: string | null = null;
    if (screenshot_data && typeof screenshot_data === 'string' && screenshot_data.startsWith('data:image/')) {
      try {
        const result = await cloudinary.uploader.upload(screenshot_data, {
          folder: 'kitagrow_receipts',
          public_id: `${req.user!.id}_${Date.now()}`,
          overwrite: false,
          resource_type: 'image',
        });
        screenshotUrl = result.secure_url;
      } catch { /* screenshot upload failed — continue without it */ }
    }

    await db('investments').insert({
      user_id: req.user!.id,
      term_days: term,
      amount: parsed,
      payout_amount: payoutAmount,
      reference: ref,
      screenshot_url: screenshotUrl,
      status: 'pending',
    });

    await logAudit(req.user!.id, 'investment_submitted', req, {
      amount: parsed,
      metadata: { term_days: term, payout_amount: payoutAmount, reference: ref },
    });

    // Notify admin + confirm to the user (fire-and-forget)
    const investor = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (investor) {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        sendKitaGrowInvestmentNotificationEmail(
          adminEmail, investor.name, investor.email, investor.id, term, parsed, payoutAmount, ref,
        ).catch((err) => console.error('[KitaGrow] Admin notification email failed:', err?.message ?? err));
      } else {
        console.warn('[KitaGrow] ADMIN_EMAIL env var is not set — skipping admin notification');
      }
      sendKitaGrowInvestmentReceivedEmail(investor.email, investor.name, term, parsed, payoutAmount, ref)
        .catch((err) => console.error('[KitaGrow] User confirmation email failed:', err?.message ?? err));
    }

    res.json({ message: 'Investment submitted! Admin will verify your GCash payment and activate it within 24 hours.' });
  } catch (err) { next(err); }
}

/* ── POST /api/investments/withdraw ────────────────────────────────────────── */
export async function requestWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, account_number, account_name } = req.body as {
      amount?: number | string; account_number?: string; account_name?: string;
    };

    const parsed = Math.round(Number(amount) * 100) / 100;
    if (!parsed || isNaN(parsed) || parsed < KG_WITHDRAW_MIN) {
      res.status(400).json({ message: `Minimum KitaGrow withdrawal is ₱${KG_WITHDRAW_MIN}.` });
      return;
    }

    const normalized = normalizeGcash(account_number ?? '');
    if (!GCASH_PATTERN.test(normalized)) {
      res.status(400).json({ message: 'Invalid GCash mobile number. Use 11 digits starting with 09 (e.g. 09171234567).' });
      return;
    }
    const nameErr = validateAccountName(account_name ?? '');
    if (nameErr) { res.status(400).json({ message: nameErr }); return; }

    // Block if there is already a withdrawal in progress.
    const pending = await db('kitagrow_withdrawals')
      .where({ user_id: req.user!.id })
      .whereIn('status', ['pending', 'processing'])
      .first();
    if (pending) {
      res.status(400).json({ message: 'You have a KitaGrow withdrawal in progress. Wait for it to be processed before requesting another.' });
      return;
    }

    let insufficient = false;
    await db.transaction(async (trx) => {
      const updated = await trx('users')
        .where({ id: req.user!.id })
        .whereRaw('COALESCE(kitagrow_balance, 0) >= ?', [parsed])
        .decrement('kitagrow_balance', parsed);
      if (updated === 0) { insufficient = true; return; }

      await trx('kitagrow_withdrawals').insert({
        user_id: req.user!.id,
        amount: parsed,
        channel: 'gcash',
        account_number: normalized,
        account_name: (account_name ?? '').trim(),
        status: 'pending',
      });
    });

    if (insufficient) { res.status(400).json({ message: 'Insufficient KitaGrow wallet balance.' }); return; }

    await logAudit(req.user!.id, 'kitagrow_withdrawal_request', req, {
      amount: parsed,
      metadata: { account_number: normalized },
    });

    res.status(201).json({ message: 'Withdrawal requested. Admin will process your GCash payout shortly.' });
  } catch (err) { next(err); }
}

/* ── Admin: investments ────────────────────────────────────────────────────── */
export async function adminListInvestments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'pending' } = req.query as { status?: string };
    const rows = await db('investments as i')
      .join('users as u', 'u.id', 'i.user_id')
      .where('i.status', status)
      .orderBy('i.created_at', 'desc')
      .select(
        'i.id', 'i.user_id', 'i.term_days', 'i.amount', 'i.payout_amount', 'i.reference',
        'i.screenshot_url', 'i.status', 'i.admin_note', 'i.activated_at', 'i.matures_at',
        'i.paid_out_at', 'i.created_at', 'u.name as user_name', 'u.email as user_email',
      );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function adminApproveInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const inv = await db('investments').where({ id }).first();
    if (!inv) { res.status(404).json({ message: 'Investment not found.' }); return; }
    if (inv.status !== 'pending') { res.status(409).json({ message: 'Investment already reviewed.' }); return; }

    const now = new Date();
    const maturesAt = new Date(now.getTime() + inv.term_days * 24 * 60 * 60 * 1000);

    await db('investments').where({ id }).update({
      status: 'active',
      activated_at: now,
      matures_at: maturesAt,
      reviewed_by: req.user!.id,
      updated_at: now,
    });

    await logAudit(req.user!.id, 'investment_approved', req, {
      metadata: { investment_id: id, user_id: inv.user_id, term_days: inv.term_days, matures_at: maturesAt },
    });

    // Notify the investor that their plan is now active (fire-and-forget)
    const owner = await db<DbUser>('users').where({ id: inv.user_id }).select('email', 'name').first();
    if (owner) {
      sendKitaGrowInvestmentActivatedEmail(
        owner.email, owner.name, inv.term_days, Number(inv.amount), Number(inv.payout_amount), maturesAt,
      ).catch((err) => console.error('[KitaGrow] Activation email failed:', err?.message ?? err));
    }

    res.json({ message: 'Investment activated.' });
  } catch (err) { next(err); }
}

export async function adminRejectInvestment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { note } = req.body as { note?: string };
    const inv = await db('investments').where({ id }).first();
    if (!inv) { res.status(404).json({ message: 'Investment not found.' }); return; }
    if (inv.status !== 'pending') { res.status(409).json({ message: 'Investment already reviewed.' }); return; }

    const trimmedNote = note?.trim() ?? null;
    await db('investments').where({ id }).update({
      status: 'rejected',
      admin_note: trimmedNote,
      reviewed_by: req.user!.id,
      updated_at: new Date(),
    });

    await logAudit(req.user!.id, 'investment_rejected', req, {
      metadata: { investment_id: id, user_id: inv.user_id, note },
    });

    // Notify the investor that their investment was not approved (fire-and-forget)
    const owner = await db<DbUser>('users').where({ id: inv.user_id }).select('email', 'name').first();
    if (owner) {
      sendKitaGrowInvestmentRejectedEmail(
        owner.email, owner.name, inv.term_days, Number(inv.amount), trimmedNote,
      ).catch((err) => console.error('[KitaGrow] Rejection email failed:', err?.message ?? err));
    }

    res.json({ message: 'Investment rejected.' });
  } catch (err) { next(err); }
}

/* ── Admin: KitaGrow withdrawals ───────────────────────────────────────────── */
export async function adminListKgWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'pending' } = req.query as { status?: string };
    const rows = await db('kitagrow_withdrawals as w')
      .join('users as u', 'u.id', 'w.user_id')
      .where('w.status', status)
      .orderBy('w.created_at', 'desc')
      .select(
        'w.id', 'w.user_id', 'w.amount', 'w.channel', 'w.account_number', 'w.account_name',
        'w.status', 'w.admin_note', 'w.created_at', 'u.name as user_name', 'u.email as user_email',
      );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function adminCompleteKgWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const w = await db('kitagrow_withdrawals').where({ id }).first();
    if (!w) { res.status(404).json({ message: 'Withdrawal not found.' }); return; }
    if (!['pending', 'processing'].includes(w.status)) {
      res.status(409).json({ message: 'Withdrawal already settled.' }); return;
    }

    await db('kitagrow_withdrawals').where({ id }).update({
      status: 'completed', reviewed_by: req.user!.id, updated_at: new Date(),
    });

    await logAudit(req.user!.id, 'kitagrow_withdrawal_completed', req, {
      amount: Number(w.amount), metadata: { withdrawal_id: id, user_id: w.user_id },
    });

    res.json({ message: 'Withdrawal marked as paid.' });
  } catch (err) { next(err); }
}

export async function adminRejectKgWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { note } = req.body as { note?: string };
    const w = await db('kitagrow_withdrawals').where({ id }).first();
    if (!w) { res.status(404).json({ message: 'Withdrawal not found.' }); return; }
    if (!['pending', 'processing'].includes(w.status)) {
      res.status(409).json({ message: 'Withdrawal already settled.' }); return;
    }

    // Refund the amount back to the KitaGrow wallet.
    await db.transaction(async (trx) => {
      await trx('kitagrow_withdrawals').where({ id }).update({
        status: 'rejected', admin_note: note?.trim() ?? null, reviewed_by: req.user!.id, updated_at: new Date(),
      });
      await trx('users').where({ id: w.user_id }).increment('kitagrow_balance', Number(w.amount));
    });

    await logAudit(req.user!.id, 'kitagrow_withdrawal_rejected', req, {
      amount: Number(w.amount), metadata: { withdrawal_id: id, user_id: w.user_id, note },
    });

    res.json({ message: 'Withdrawal rejected and amount refunded to the user\'s KitaGrow wallet.' });
  } catch (err) { next(err); }
}
