import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await db('notifications')
      .where({ user_id: req.user!.id })
      .orderBy('created_at', 'desc')
      .limit(30)
      .select('id', 'type', 'title', 'message', 'read_at', 'created_at');
    res.json(rows);
  } catch (err) { next(err); }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await db('notifications')
      .where({ user_id: req.user!.id })
      .whereNull('read_at')
      .update({ read_at: db.fn.now() });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
