import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../../config/database';
import { DbUser, DbLoginEvent } from '../types';

import { logAudit } from '../services/audit';
import { sendPasswordChangedEmail } from '../services/email';

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { current_password, new_password } = req.body as { current_password: string; new_password: string };
    if (!current_password || !new_password) {
      res.status(400).json({ message: 'current_password and new_password are required.' });
      return;
    }
    if (new_password.length < 8 || new_password.length > 128) {
      res.status(400).json({ message: 'New password must be 8–128 characters.' });
      return;
    }
    if (!/[A-Za-z]/.test(new_password) || !/[0-9]/.test(new_password)) {
      res.status(400).json({ message: 'New password must contain letters and numbers.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) { res.status(401).json({ message: 'Current password is incorrect.' }); return; }

    if (current_password === new_password) {
      res.status(400).json({ message: 'New password must be different from current password.' });
      return;
    }

    const hash = await bcrypt.hash(new_password, 12);
    await db('users').where({ id: user.id }).update({ password_hash: hash });

    // Revoke all refresh tokens to force re-login on all devices
    await db('refresh_tokens').where({ user_id: user.id }).whereNull('revoked_at').update({ revoked_at: new Date() });

    await logAudit(user.id, 'password_change', req);
    sendPasswordChangedEmail(user.email, user.name).catch(() => {});

    res.json({ message: 'Password changed successfully. Please log in again on all devices.' });
  } catch (err) { next(err); }
}

export async function deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { password } = req.body as { password: string };
    if (!password) { res.status(400).json({ message: 'Password is required to delete your account.' }); return; }

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) { res.status(401).json({ message: 'Incorrect password.' }); return; }

    await logAudit(user.id, 'account_delete', req);

    // Soft-delete: anonymize PII instead of hard delete (audit trail preserved)
    await db('users').where({ id: user.id }).update({
      name: `Deleted User ${user.id}`,
      email: `deleted_${user.id}@kitazon.invalid`,
      password_hash: 'DELETED',
      referral_code: `DEL${user.id}`,
      is_active: false,
      email_verified: false,
    });

    // Revoke all sessions and pending OTPs
    await db('refresh_tokens').where({ user_id: user.id }).update({ revoked_at: new Date() });
    await db('otp_tokens').where({ user_id: user.id }).whereNull('used_at').update({ used_at: new Date() });

    res.json({ message: 'Account deleted successfully.' });
  } catch (err) { next(err); }
}

export async function activeSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = req.cookies?.refresh_token as string | undefined;
    const currentHash = raw ? crypto.createHash('sha256').update(raw).digest('hex') : null;

    const sessions = await db('refresh_tokens')
      .where({ user_id: req.user!.id })
      .whereNull('revoked_at')
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .select('id', 'created_at', 'expires_at');

    res.json(sessions.map((s: { id: number; created_at: Date; expires_at: Date }) => ({
      id: s.id,
      created_at: s.created_at,
      expires_at: s.expires_at,
      is_current: currentHash ? db('refresh_tokens').where({ id: s.id, token_hash: currentHash }).select('id') !== null : false,
    })));
  } catch (err) { next(err); }
}

export async function revokeOtherSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = req.cookies?.refresh_token as string | undefined;
    const currentHash = raw ? crypto.createHash('sha256').update(raw).digest('hex') : null;

    const query = db('refresh_tokens')
      .where({ user_id: req.user!.id })
      .whereNull('revoked_at');
    if (currentHash) query.whereNot({ token_hash: currentHash });

    const count = await query.clone().count('id as cnt').first();
    await query.update({ revoked_at: new Date() });

    await logAudit(req.user!.id, 'revoke_other_sessions', req, { metadata: { revoked: Number(count?.cnt ?? 0) } });
    res.json({ message: 'All other sessions revoked.', revoked: Number(count?.cnt ?? 0) });
  } catch (err) { next(err); }
}

export async function loginHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const events = await db<DbLoginEvent>('login_events')
      .where({ user_id: req.user!.id })
      .orderBy('created_at', 'desc')
      .limit(20)
      .select('id', 'success', 'ip_address', 'user_agent', 'created_at');
    res.json(events);
  } catch (err) { next(err); }
}
