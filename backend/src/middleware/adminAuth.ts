import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';

export default async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ message: 'Authentication required.' }); return; }
  const row = await db('users').where({ id: req.user.id }).select('is_admin', 'is_active').first();
  if (!row?.is_admin || !row?.is_active) { res.status(403).json({ message: 'Admin access required.' }); return; }
  next();
}
