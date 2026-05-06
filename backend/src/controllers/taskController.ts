import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbTask, DbEarning } from '../types';

const SPIN_PRIZES = [5, 5, 10, 10, 15, 20, 25, 50, 75, 100];

const VALID_CATEGORIES = ['survey', 'app_install', 'video', 'microjob', 'game'] as const;

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = db<DbTask>('tasks').where({ is_active: true }).orderBy('payout', 'desc');
    const { category } = req.query;
    if (category) {
      if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
        res.status(400).json({ message: 'Invalid category.' });
        return;
      }
      query.where({ category });
    }
    res.json(await query);
  } catch (err) { next(err); }
}

export async function complete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      res.status(400).json({ message: 'Invalid task ID.' });
      return;
    }

    const task = await db<DbTask>('tasks').where({ id: taskId, is_active: true }).first();
    if (!task) {
      res.status(404).json({ message: 'Task not found.' });
      return;
    }

    let duplicate = false;
    await db.transaction(async (trx) => {
      // Check inside transaction to prevent race condition
      const alreadyDone = await trx<DbEarning>('earnings')
        .where({ user_id: req.user!.id, task_id: taskId })
        .first();
      if (alreadyDone) {
        duplicate = true;
        return;
      }

      await trx('earnings').insert({ user_id: req.user!.id, task_id: taskId, amount: task.payout, type: 'task', description: task.title });
      await trx('users').where({ id: req.user!.id }).increment('balance', task.payout);

      const referral = await trx('referrals').where({ referred_id: req.user!.id }).first();
      if (referral) {
        const commission = parseFloat((task.payout * 0.20).toFixed(2));
        await trx('referrals').where({ id: referral.id }).increment('commission_earned', commission);
        await trx('earnings').insert({ user_id: referral.referrer_id, task_id: taskId, amount: commission, type: 'referral_commission', description: `Referral commission — ${task.title}` });
        await trx('users').where({ id: referral.referrer_id }).increment('balance', commission);
      }
    });

    if (duplicate) {
      res.status(409).json({ message: 'You already completed this task.' });
      return;
    }

    res.json({ message: 'Task completed!', amount: task.payout });
  } catch (err) { next(err); }
}

export async function spin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let alreadySpun = false;
    let amount = 0;

    await db.transaction(async (trx) => {
      // Check inside transaction to prevent race condition
      const spunToday = await trx<DbEarning>('earnings')
        .where({ user_id: req.user!.id, type: 'spin' })
        .where('created_at', '>=', today)
        .first();

      if (spunToday) {
        alreadySpun = true;
        return;
      }

      amount = SPIN_PRIZES[Math.floor(Math.random() * SPIN_PRIZES.length)];
      await trx('earnings').insert({ user_id: req.user!.id, task_id: null, amount, type: 'spin', description: 'Daily spin wheel' });
      await trx('users').where({ id: req.user!.id }).increment('balance', amount);
    });

    if (alreadySpun) {
      res.status(409).json({ message: 'Already spun today. Come back tomorrow!' });
      return;
    }

    res.json({ amount });
  } catch (err) { next(err); }
}

export async function earningsChart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days = 7;
    const rows = await db('earnings')
      .where({ user_id: req.user!.id })
      .where('created_at', '>=', db.raw(`NOW() - INTERVAL '${days} days'`))
      .select(db.raw('DATE(created_at) as date'), db.raw('SUM(amount) as total'))
      .groupByRaw('DATE(created_at)')
      .orderBy('date', 'asc');

    // Fill missing days with 0
    const result: { date: string; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = rows.find((r: { date: string; total: string }) => String(r.date).slice(0, 10) === key);
      result.push({ date: key, total: found ? Number(found.total) : 0 });
    }
    res.json(result);
  } catch (err) { next(err); }
}


export async function recentEarnings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = 10;
    const offset = (page - 1) * limit;

    const [earnings, [count]] = await Promise.all([
      db('earnings')
        .where({ 'earnings.user_id': req.user!.id })
        .leftJoin('tasks', 'earnings.task_id', 'tasks.id')
        .select('earnings.id', 'earnings.amount', 'earnings.type', 'earnings.created_at', db.raw("COALESCE(tasks.title, earnings.description) as task_title"))
        .orderBy('earnings.created_at', 'desc')
        .limit(limit).offset(offset),
      db('earnings').where({ user_id: req.user!.id }).count('id as total'),
    ]);

    res.json({ earnings, total: Number(count.total), page, pages: Math.ceil(Number(count.total) / limit) });
  } catch (err) { next(err); }
}
