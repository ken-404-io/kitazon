import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';
import { tokenBlacklist } from '../controllers/authController';
import db from '../../config/database';

// Track last write time per user to avoid hammering the DB on every request
const lastActiveWritten = new Map<number, number>();
const ACTIVE_WRITE_INTERVAL_MS = 60_000; // write at most once per minute per user

export default function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload & { jti?: string };
    if (payload.jti && tokenBlacklist.has(payload.jti)) {
      res.status(401).json({ message: 'Token has been revoked. Please log in again.' });
      return;
    }
    req.user = payload;

    // Update last_active_at at most once per minute per user (fire-and-forget)
    const userId = payload.id;
    const now = Date.now();
    const lastWrite = lastActiveWritten.get(userId) ?? 0;
    if (now - lastWrite > ACTIVE_WRITE_INTERVAL_MS) {
      lastActiveWritten.set(userId, now);
      db('users').where({ id: userId }).update({ last_active_at: new Date() }).catch(() => {});
    }

    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
