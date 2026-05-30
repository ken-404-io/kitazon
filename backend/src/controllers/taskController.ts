import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbTask, DbEarning, DbUser } from '../types';
import { sendWelcomeBonusEmail } from '../services/email';

const SPIN_PRIZES = [5, 5, 10, 10, 15, 20, 25, 50, 75, 100];

const WELCOME_BONUS = 400;

const VALID_CATEGORIES = ['survey', 'app_install', 'video', 'microjob', 'game'] as const;

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasks = await db<DbTask>('tasks').where({ is_active: true }).orderBy('payout', 'desc');
    const completedIds = await db('earnings')
      .where({ user_id: req.user!.id, type: 'task' })
      .whereNotNull('task_id')
      .pluck('task_id');
    const completedSet = new Set(completedIds.map(Number));
    res.json(tasks.map(t => ({ ...t, is_completed: completedSet.has(t.id) })));
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
      .whereRaw(`(created_at AT TIME ZONE 'Asia/Manila')::date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '${days - 1} days'`)
      .select(
        db.raw(`(created_at AT TIME ZONE 'Asia/Manila')::date as date`),
        db.raw('SUM(amount) as total'),
      )
      .groupByRaw(`(created_at AT TIME ZONE 'Asia/Manila')::date`)
      .orderBy('date', 'asc');

    // Fill missing days with 0 using PH local date
    const result: { date: string; total: number }[] = [];
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(nowPH);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const found = rows.find((r: { date: unknown; total: string }) => String(r.date).slice(0, 10) === key);
      result.push({ date: key, total: found ? Number(found.total) : 0 });
    }
    res.json(result);
  } catch (err) { next(err); }
}


export async function dailyCheckin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today — match both 'checkin' type and legacy 'task' type with checkin description
    const alreadyDone = await db<DbEarning>('earnings')
      .where({ user_id: req.user!.id })
      .where('created_at', '>=', today)
      .where(function () {
        this.where('type', 'checkin').orWhere(function () {
          this.where('type', 'task').where('description', 'like', 'Daily check-in%');
        });
      })
      .first();

    // Fetch all checkin dates for streak calculation
    const checkinDates = await db('earnings')
      .where({ user_id: req.user!.id })
      .where(function () {
        this.where('type', 'checkin').orWhere(function () {
          this.where('type', 'task').where('description', 'like', 'Daily check-in%');
        });
      })
      .orderBy('created_at', 'desc')
      .select(db.raw('DATE(created_at) as day'));

    // Build set of unique days
    const daySet = new Set<string>(checkinDates.map((r: { day: string }) => String(r.day).slice(0, 10)));

    // Calculate streak length based on consecutive days ending at yesterday (or today if already done)
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (alreadyDone) {
      // today counts, walk from today backwards
    } else {
      // not yet done — walk from yesterday backwards to find existing streak
      cursor.setDate(cursor.getDate() - 1);
    }
    // Count consecutive days present in daySet
    for (let i = 0; i < 366; i++) {
      const key = cursor.toISOString().slice(0, 10);
      if (daySet.has(key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    if (alreadyDone) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      res.status(409).json({ message: 'Already checked in today.', streak, next_checkin_at: tomorrow });
      return;
    }

    // New streak will be yesterday's streak + 1
    const newStreak = streak + 1;

    // Determine bonus amount
    let amount: number;
    if (newStreak >= 30) {
      amount = 5;
    } else if (newStreak >= 7) {
      amount = 3;
    } else {
      amount = 1;
    }

    await db.transaction(async (trx) => {
      const earningRow = { user_id: req.user!.id, task_id: null, amount, description: `Daily check-in bonus — Day ${newStreak}` };
      await trx.raw('SAVEPOINT sp_checkin');
      try {
        await trx('earnings').insert({ ...earningRow, type: 'checkin' });
        await trx.raw('RELEASE SAVEPOINT sp_checkin');
      } catch {
        await trx.raw('ROLLBACK TO SAVEPOINT sp_checkin');
        await trx('earnings').insert({ ...earningRow, type: 'task' });
      }
      await trx('users').where({ id: req.user!.id }).increment('balance', amount);
      await trx.raw('SAVEPOINT sp_checkin_credits');
      try {
        await trx('users').where({ id: req.user!.id }).increment('withdrawal_credits', 1);
        await trx.raw('RELEASE SAVEPOINT sp_checkin_credits');
      } catch {
        await trx.raw('ROLLBACK TO SAVEPOINT sp_checkin_credits');
      }
    });

    res.json({ message: `Check-in successful! You earned ₱${amount} and +1 withdrawal credit.`, amount, streak: newStreak, already_done: false });
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

const QUIZ_REWARD = 3.00;
// Daily cap on the number of paid quiz answers, per plan. Silver, Gold and
// Diamond have NO quiz earning limit (unlimited per day).
const QUIZ_DAILY_LIMITS: Record<string, number> = {
  free:    150,
  bronze:  150,
};
const UNLIMITED_QUIZ_PLANS = new Set(['silver', 'gold', 'diamond']);

export async function quizCorrect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userRow = await db('users').where({ id: req.user!.id }).select('plan').first();
    const plan = (userRow?.plan ?? 'free') as string;

    // Enforce the daily quiz cap only for plans that have one.
    if (!UNLIMITED_QUIZ_PLANS.has(plan)) {
      const dailyMax = QUIZ_DAILY_LIMITS[plan] ?? QUIZ_DAILY_LIMITS.free;
      const countToday = await db('earnings')
        .where({ user_id: req.user!.id, type: 'quiz' })
        .where('created_at', '>=', today)
        .count('id as n')
        .first();

      if (Number((countToday as any)?.n ?? 0) >= dailyMax) {
        res.status(429).json({ message: 'Daily quiz limit reached. Come back tomorrow!', amount: 0, capped: true });
        return;
      }
    }

    await db.transaction(async (trx) => {
      await trx('earnings').insert({
        user_id: req.user!.id,
        task_id: null,
        amount: QUIZ_REWARD,
        type: 'quiz',
        description: 'Math quiz correct answer',
      });
      await trx('users').where({ id: req.user!.id }).increment('balance', QUIZ_REWARD);
    });

    res.json({ amount: QUIZ_REWARD, capped: false });
  } catch (err) { next(err); }
}

// GET /api/tasks/quiz/status — how much quiz earning room the user has left today.
// Lets the quiz UI show a "daily limit reached" screen up front (and skip it for
// unlimited plans) instead of letting the user keep playing for ₱0.
export async function quizStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userRow = await db('users').where({ id: req.user!.id }).select('plan').first();
    const plan = (userRow?.plan ?? 'free') as string;

    if (UNLIMITED_QUIZ_PLANS.has(plan)) {
      res.json({ unlimited: true, capped: false, reward: QUIZ_REWARD });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const countToday = await db('earnings')
      .where({ user_id: req.user!.id, type: 'quiz' })
      .where('created_at', '>=', today)
      .count('id as n')
      .first();
    const answered = Number((countToday as any)?.n ?? 0);
    const dailyMax = QUIZ_DAILY_LIMITS[plan] ?? QUIZ_DAILY_LIMITS.free;

    res.json({
      unlimited: false,
      capped: answered >= dailyMax,
      answered_today: answered,
      daily_limit: dailyMax,
      reward: QUIZ_REWARD,
    });
  } catch (err) { next(err); }
}

export async function claimWelcomeBonus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let alreadyClaimed = false;
    let userRow: DbUser | undefined;

    await db.transaction(async (trx) => {
      // Lock the user row to prevent concurrent double-claims
      userRow = await trx<DbUser>('users').where({ id: req.user!.id }).forUpdate().first();
      if (!userRow) return;

      if (userRow.welcome_bonus_claimed_at) {
        alreadyClaimed = true;
        return;
      }

      await trx('earnings').insert({
        user_id: req.user!.id,
        task_id: null,
        amount: WELCOME_BONUS,
        type: 'welcome_bonus',
        description: 'Welcome bonus',
      });
      await trx('users').where({ id: req.user!.id }).increment('balance', WELCOME_BONUS);
      await trx('users').where({ id: req.user!.id }).update({ welcome_bonus_claimed_at: new Date() });
    });

    if (!userRow) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    if (alreadyClaimed) {
      res.status(409).json({ message: 'You have already claimed your welcome bonus.' });
      return;
    }

    sendWelcomeBonusEmail(userRow.email, userRow.name, WELCOME_BONUS).catch(() => {});

    res.json({ message: `Congratulations! ₱${WELCOME_BONUS} has been added to your balance.`, amount: WELCOME_BONUS });
  } catch (err) { next(err); }
}
