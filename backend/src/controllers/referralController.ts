import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser } from '../types';

export async function leaderboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await db('referrals as r')
      .join('users as u', 'r.referrer_id', 'u.id')
      .select(
        'u.name',
        db.raw('COUNT(r.id) as referral_count'),
        db.raw('SUM(r.commission_earned) as total_earned')
      )
      .groupBy('r.referrer_id', 'u.name')
      .orderBy('total_earned', 'desc')
      .limit(20);

    res.json(rows.map((r: { name: string; referral_count: string; total_earned: string }, i: number) => ({
      rank: i + 1,
      name: r.name,
      referral_count: Number(r.referral_count),
      total_earned: Number(r.total_earned ?? 0),
    })));
  } catch (err) { next(err); }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();

    const [commissionRow] = await db('referrals').where({ referrer_id: req.user!.id }).sum('commission_earned as total');
    const referralCountRow = await db('referrals').where({ referrer_id: req.user!.id }).count('id as count').first();

    const list = await db('referrals')
      .where({ 'referrals.referrer_id': req.user!.id })
      .join('users', 'referrals.referred_id', 'users.id')
      .select('referrals.id', 'users.name', 'referrals.commission_earned', 'referrals.created_at');

    res.json({
      stats: {
        referral_code: user?.referral_code,
        referral_count: parseInt(String(referralCountRow?.count ?? 0)),
        lifetime_earnings: commissionRow?.total ?? 0,
      },
      list,
    });
  } catch (err) { next(err); }
}
