import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser } from '../types';

export async function leaderboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await db('users as u')
      .leftJoin('referrals as r', function () {
        this.on('r.referrer_id', 'u.id');
      })
      .leftJoin('users as referred', 'r.referred_id', 'referred.id')
      .select(
        'u.name',
        db.raw('COUNT(CASE WHEN referred.email_verified = true THEN r.id END) + COALESCE(u.referral_count_adjustment, 0) AS referral_count'),
        db.raw('COALESCE(SUM(CASE WHEN referred.email_verified = true THEN r.commission_earned ELSE 0 END), 0) AS total_earned')
      )
      .groupBy('u.id', 'u.name', 'u.referral_count_adjustment')
      .havingRaw('COUNT(CASE WHEN referred.email_verified = true THEN r.id END) + COALESCE(u.referral_count_adjustment, 0) > 0')
      .orderByRaw('COUNT(CASE WHEN referred.email_verified = true THEN r.id END) + COALESCE(u.referral_count_adjustment, 0) DESC')
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

    const [commissionRow] = await db('referrals')
      .join('users as referred', 'referrals.referred_id', 'referred.id')
      .where({ referrer_id: req.user!.id })
      .where('referred.email_verified', true)
      .sum('commission_earned as total');
    const referralCountRow = await db('referrals')
      .join('users as referred', 'referrals.referred_id', 'referred.id')
      .where({ referrer_id: req.user!.id })
      .where('referred.email_verified', true)
      .count('referrals.id as count').first();
    const adjustment = Number((user as { referral_count_adjustment?: number })?.referral_count_adjustment ?? 0);

    const list = await db('referrals')
      .where({ 'referrals.referrer_id': req.user!.id })
      .join('users', 'referrals.referred_id', 'users.id')
      .where('users.email_verified', true)
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
