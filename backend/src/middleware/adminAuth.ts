import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';

export default async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ message: 'Authentication required.' }); return; }
  const row = await db('users').where({ id: req.user.id }).select('is_admin').first();
  if (!row?.is_admin) { res.status(403).json({ message: 'Admin access required.' }); return; }
  next();
}
