import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser } from '../types';

export async function leaderboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await db('users as u')
      .leftJoin('referrals as r', 'r.referrer_id', 'u.id')
      .select(
        'u.name',
        db.raw('COUNT(r.id) + COALESCE(u.referral_count_adjustment, 0) AS referral_count'),
        db.raw('COALESCE(SUM(r.commission_earned), 0) AS total_earned')
      )
      .groupBy('u.id', 'u.name', 'u.referral_count_adjustment')
      .havingRaw('COUNT(r.id) + COALESCE(u.referral_count_adjustment, 0) > 0')
      .orderByRaw('COUNT(r.id) + COALESCE(u.referral_count_adjustment, 0) DESC')
      .limit(20);

    res.json(rows.map((r: { name: string; referral_count: string; total_earned: string }, i: number) => ({
      rank: i + 1,
      name: r.name,
      referral_count: Math.max(0, Number(r.referral_count)),
      total_earned: Number(r.total_earned ?? 0),
    })));
  } catch (err) { next(err); }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();

    const [commissionRow] = await db('referrals').where({ referrer_id: req.user!.id }).sum('commission_earned as total');
    const referralCountRow = await db('referrals').where({ referrer_id: req.user!.id }).count('id as count').first();
    const adjustment = Number((user as { referral_count_adjustment?: number })?.referral_count_adjustment ?? 0);

    const list = await db('referrals')
      .where({ 'referrals.referrer_id': req.user!.id })
      .join('users', 'referrals.referred_id', 'users.id')
      .select('referrals.id', 'users.name', 'referrals.commission_earned', 'referrals.created_at');

    res.json({
      stats: {
        referral_code: user?.referral_code,
        referral_count: Math.max(0, parseInt(String(referralCountRow?.count ?? 0)) + adjustment),
        lifetime_earnings: commissionRow?.total ?? 0,
      },
      list,
    });
  } catch (err) { next(err); }
}
