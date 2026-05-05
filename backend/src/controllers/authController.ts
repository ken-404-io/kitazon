import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../config/database';
import { AuthRequest, DbUser } from '../types';

const sign = (user: DbUser): string =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: '30d' });

const safeUser = (u: DbUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  balance: u.balance,
  referral_code: u.referral_code,
});

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, referral_code } = req.body as {
      name: string; email: string; password: string; referral_code?: string;
    };

    if (!name || !email || !password) {
      res.status(400).json({ message: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters.' });
      return;
    }

    const exists = await db<DbUser>('users').where({ email: email.toLowerCase() }).first();
    if (exists) {
      res.status(409).json({ message: 'Email already registered.' });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();

    const [user] = await db<DbUser>('users').insert({
      name,
      email: email.toLowerCase(),
      password_hash: hash,
      referral_code: code,
      balance: 0,
    }).returning('*');

    if (referral_code) {
      const referrer = await db<DbUser>('users').where({ referral_code: referral_code.toUpperCase() }).first();
      if (referrer) {
        await db('referrals').insert({ referrer_id: referrer.id, referred_id: user.id, commission_earned: 0 });
        await db('earnings').insert({ user_id: referrer.id, task_id: null, amount: 50, type: 'referral_signup', description: `Referral signup bonus — ${name}` });
        await db<DbUser>('users').where({ id: referrer.id }).increment('balance', 50);
      }
    }

    res.status(201).json({ token: sign(user), user: safeUser(user) });
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password required.' });
      return;
    }

    const user = await db<DbUser>('users').where({ email: email.toLowerCase() }).first();
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    res.json({ token: sign(user), user: safeUser(user) });
  } catch (err) { next(err); }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user.id }).first();
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }
    res.json(safeUser(user));
  } catch (err) { next(err); }
}

export async function stats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await db<DbUser>('users').where({ id: req.user.id }).first();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [today] = await db('earnings').where({ user_id: req.user.id }).where('created_at', '>=', todayStart).sum('amount as total');
    const [week] = await db('earnings').where({ user_id: req.user.id }).where('created_at', '>=', weekStart).sum('amount as total');
    const [total] = await db('earnings').where({ user_id: req.user.id }).sum('amount as total');

    res.json({
      balance: user?.balance ?? 0,
      today: today?.total ?? 0,
      week: week?.total ?? 0,
      total: total?.total ?? 0,
    });
  } catch (err) { next(err); }
}
