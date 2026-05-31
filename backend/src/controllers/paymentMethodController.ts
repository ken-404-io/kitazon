import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import db from '../../config/database';
import { DbUser } from '../types';
import { logAudit } from '../services/audit';
import { createNotification } from '../services/notify';
import {
  sendPaymentChangeReceivedEmail,
  sendPaymentMethodUpdatedEmail,
  sendPaymentChangeRejectedEmail,
} from '../services/email';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
  if (/paypal/i.test(trimmed)) return 'PayPal is not supported. Enter the full name on the GCash account.';
  return null;
}

// Returns the user's current saved GCash number: the admin-set one if present,
// otherwise the number from their most recent (non-cleared) withdrawal.
async function currentNumberFor(userId: number): Promise<string | null> {
  const u = await db<DbUser>('users').where({ id: userId }).first();
  const adminSet = (u as DbUser & { gcash_number?: string | null })?.gcash_number ?? null;
  if (adminSet) return adminSet;
  try {
    const clearedAt = (u as DbUser & { payment_method_cleared_at?: Date | null })?.payment_method_cleared_at ?? null;
    let q = db('withdrawals').where({ user_id: userId });
    if (clearedAt) q = q.where('created_at', '>', clearedAt);
    const last = await q.orderBy('created_at', 'desc').select('account_number').first();
    return last?.account_number ?? null;
  } catch { return null; }
}

// Validate that a GCash number isn't already locked to another user. Returns an
// error message or null when free to use.
async function numberTakenByOther(number: string, exceptUserId: number): Promise<string | null> {
  const otherUser = await db('users')
    .where({ gcash_number: number })
    .whereNot({ id: exceptUserId })
    .first();
  if (otherUser) return 'This GCash number is already linked to another account.';

  try {
    const taken = await db('withdrawals as w')
      .leftJoin('users as u', 'w.user_id', 'u.id')
      .where('w.account_number', number)
      .whereNot({ 'w.user_id': exceptUserId })
      .where((b) => {
        b.whereNull('u.payment_method_cleared_at')
         .orWhereRaw('u.payment_method_cleared_at < w.created_at');
      })
      .first();
    if (taken) return 'This GCash number is already linked to another account.';
  } catch { /* column not migrated — skip */ }
  return null;
}

// Apply a new payment method to a user: lock the number/name and reset the
// withdrawal lock so the new account is treated as the active one.
async function applyPaymentMethod(userId: number, number: string, name: string): Promise<void> {
  await db('users').where({ id: userId }).update({
    gcash_number: number,
    gcash_name: name,
    payment_method_cleared_at: new Date(),
  });
}

/* ── User: submit a change request ─────────────────────────────────────────── */
export async function submitChangeRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason, requested_number, requested_name, screenshot_data } = req.body as {
      reason?: string; requested_number?: string; requested_name?: string; screenshot_data?: string;
    };

    const reasonTrim = (reason ?? '').trim();
    if (reasonTrim.length < 10 || reasonTrim.length > 1000) {
      res.status(400).json({ message: 'Please explain why you want to change your account (10–1000 characters).' });
      return;
    }

    const number = normalizeGcash(requested_number ?? '');
    if (!GCASH_PATTERN.test(number)) {
      res.status(400).json({ message: 'Enter a valid new GCash number (11 digits starting with 09).' });
      return;
    }
    const nameErr = validateAccountName(requested_name ?? '');
    if (nameErr) { res.status(400).json({ message: nameErr }); return; }

    if (!screenshot_data || typeof screenshot_data !== 'string' || !screenshot_data.startsWith('data:image/')) {
      res.status(400).json({ message: 'A screenshot of your GCash account is required as proof.' });
      return;
    }

    // Block if there is already a pending request.
    const existing = await db('payment_change_requests')
      .where({ user_id: req.user!.id, status: 'pending' })
      .first();
    if (existing) {
      res.status(400).json({ message: 'You already have a pending change request. Please wait for it to be reviewed.' });
      return;
    }

    const takenErr = await numberTakenByOther(number, req.user!.id);
    if (takenErr) { res.status(409).json({ message: takenErr }); return; }

    let screenshotUrl: string | null = null;
    try {
      const result = await cloudinary.uploader.upload(screenshot_data, {
        folder: 'payment_change_proofs',
        public_id: `${req.user!.id}_${Date.now()}`,
        overwrite: false,
        resource_type: 'image',
      });
      screenshotUrl = result.secure_url;
    } catch {
      res.status(400).json({ message: 'Could not upload your screenshot. Please try a smaller image.' });
      return;
    }

    const currentNumber = await currentNumberFor(req.user!.id);

    const [row] = await db('payment_change_requests').insert({
      user_id: req.user!.id,
      current_number: currentNumber,
      requested_number: number,
      requested_name: (requested_name ?? '').trim(),
      reason: reasonTrim,
      screenshot_url: screenshotUrl,
      status: 'pending',
    }).returning('id');
    const requestId = typeof row === 'object' ? (row as { id: number }).id : row;

    await logAudit(req.user!.id, 'payment_change_requested', req, {
      metadata: { request_id: requestId, requested_number: number },
    });

    // Notify the user only (in-app + email), fire-and-forget. Admins are not
    // emailed or notified — pending requests surface via the Payment Changes
    // tab badge in the admin panel.
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (user) {
      createNotification(user.id, 'payment_change', 'Change request submitted',
        `We received your request to change your GCash account to ${number}. We'll review it within 24 hours.`);
      sendPaymentChangeReceivedEmail(user.email, user.name, number, (requested_name ?? '').trim()).catch(() => {});
    }

    res.status(201).json({ message: 'Change request submitted! Our team will review your proof and update your account within 24 hours.' });
  } catch (err) { next(err); }
}

/* ── User: my latest change request ────────────────────────────────────────── */
export async function myChangeRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const row = await db('payment_change_requests')
      .where({ user_id: req.user!.id })
      .orderBy('created_at', 'desc')
      .select('id', 'requested_number', 'requested_name', 'reason', 'status', 'admin_note', 'created_at')
      .first();
    res.json(row ?? null);
  } catch (err) { next(err); }
}

/* ── Admin: list change requests ───────────────────────────────────────────── */
export async function adminListChangeRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'pending' } = req.query as { status?: string };
    const rows = await db('payment_change_requests as r')
      .join('users as u', 'u.id', 'r.user_id')
      .where('r.status', status)
      .orderBy('r.created_at', 'desc')
      .select(
        'r.id', 'r.user_id', 'r.current_number', 'r.requested_number', 'r.requested_name',
        'r.reason', 'r.screenshot_url', 'r.status', 'r.admin_note', 'r.created_at',
        'u.name as user_name', 'u.email as user_email',
        'u.gcash_name as current_name',
      );

    // Enrich each row with the user's *live* current number (admin-set, or
    // derived from their latest withdrawal). Older requests — and any submitted
    // before a current number could be captured — may have a null snapshot, so
    // we fall back to the live value to ensure the admin always sees the user's
    // active GCash account.
    const enriched = await Promise.all(rows.map(async (r) => {
      const liveCurrent = await currentNumberFor(r.user_id);
      return {
        ...r,
        current_number: r.current_number ?? liveCurrent,
        current_number_live: liveCurrent,
      };
    }));

    res.json(enriched);
  } catch (err) { next(err); }
}

/* ── Admin: approve a change request ───────────────────────────────────────── */
export async function adminApproveChangeRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { number: overrideNumber, name: overrideName } = req.body as { number?: string; name?: string };

    const reqRow = await db('payment_change_requests').where({ id }).first();
    if (!reqRow) { res.status(404).json({ message: 'Request not found.' }); return; }
    if (reqRow.status !== 'pending') { res.status(409).json({ message: 'Request already reviewed.' }); return; }

    // Admin may correct the number/name read off the proof before approving.
    const number = normalizeGcash(overrideNumber ?? reqRow.requested_number);
    const name = (overrideName ?? reqRow.requested_name ?? '').trim();
    if (!GCASH_PATTERN.test(number)) { res.status(400).json({ message: 'Invalid GCash number.' }); return; }
    const nameErr = validateAccountName(name);
    if (nameErr) { res.status(400).json({ message: nameErr }); return; }

    const takenErr = await numberTakenByOther(number, reqRow.user_id);
    if (takenErr) { res.status(409).json({ message: takenErr }); return; }

    await applyPaymentMethod(reqRow.user_id, number, name);
    await db('payment_change_requests').where({ id }).update({
      status: 'approved', requested_number: number, requested_name: name,
      reviewed_by: req.user!.id, updated_at: new Date(),
    });

    await logAudit(req.user!.id, 'payment_change_approved', req, {
      metadata: { request_id: id, user_id: reqRow.user_id, new_number: number },
    });

    const owner = await db<DbUser>('users').where({ id: reqRow.user_id }).select('email', 'name').first();
    if (owner) {
      createNotification(reqRow.user_id, 'payment_change', 'Withdrawal account updated',
        `Your GCash withdrawal account has been updated to ${number}.`);
      sendPaymentMethodUpdatedEmail(owner.email, owner.name, number, name).catch(() => {});
    }

    res.json({ message: 'Payment method updated and request approved.' });
  } catch (err) { next(err); }
}

/* ── Admin: reject a change request ────────────────────────────────────────── */
export async function adminRejectChangeRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { note } = req.body as { note?: string };
    const reqRow = await db('payment_change_requests').where({ id }).first();
    if (!reqRow) { res.status(404).json({ message: 'Request not found.' }); return; }
    if (reqRow.status !== 'pending') { res.status(409).json({ message: 'Request already reviewed.' }); return; }

    const trimmedNote = note?.trim() ?? null;
    await db('payment_change_requests').where({ id }).update({
      status: 'rejected', admin_note: trimmedNote, reviewed_by: req.user!.id, updated_at: new Date(),
    });

    await logAudit(req.user!.id, 'payment_change_rejected', req, {
      metadata: { request_id: id, user_id: reqRow.user_id, note: trimmedNote },
    });

    const owner = await db<DbUser>('users').where({ id: reqRow.user_id }).select('email', 'name').first();
    if (owner) {
      createNotification(reqRow.user_id, 'payment_change', 'Change request not approved',
        `Your request to change your GCash account to ${reqRow.requested_number} was not approved.${trimmedNote ? ' Reason: ' + trimmedNote : ''}`);
      sendPaymentChangeRejectedEmail(owner.email, owner.name, reqRow.requested_number, trimmedNote).catch(() => {});
    }

    res.json({ message: 'Change request rejected.' });
  } catch (err) { next(err); }
}

/* ── Admin: directly set a user's payment method (Manage button) ───────────── */
export async function adminSetPaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number(req.params.id);
    const { number: rawNumber, name: rawName } = req.body as { number?: string; name?: string };

    const user = await db<DbUser>('users').where({ id: userId }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const number = normalizeGcash(rawNumber ?? '');
    if (!GCASH_PATTERN.test(number)) { res.status(400).json({ message: 'Enter a valid GCash number (11 digits starting with 09).' }); return; }
    const name = (rawName ?? '').trim();
    const nameErr = validateAccountName(name);
    if (nameErr) { res.status(400).json({ message: nameErr }); return; }

    const takenErr = await numberTakenByOther(number, userId);
    if (takenErr) { res.status(409).json({ message: takenErr }); return; }

    await applyPaymentMethod(userId, number, name);

    await logAudit(req.user!.id, 'admin_set_payment_method', req, {
      metadata: { target_user_id: userId, new_number: number },
    });

    createNotification(userId, 'payment_change', 'Withdrawal account updated',
      `An administrator updated your GCash withdrawal account to ${number}.`);
    sendPaymentMethodUpdatedEmail(user.email, user.name, number, name).catch(() => {});

    res.json({ message: 'Payment method updated.', gcash_number: number, gcash_name: name });
  } catch (err) { next(err); }
}

/* ── Admin: read a user's current payment method ───────────────────────────── */
export async function adminGetPaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number(req.params.id);
    const user = await db<DbUser>('users').where({ id: userId }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    const u = user as DbUser & { gcash_number?: string | null; gcash_name?: string | null };
    res.json({
      gcash_number: u.gcash_number ?? null,
      gcash_name: u.gcash_name ?? null,
      derived_number: await currentNumberFor(userId),
    });
  } catch (err) { next(err); }
}
