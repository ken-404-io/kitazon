import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser, DbWithdrawal, WithdrawalStatus } from '../types';
import { logAudit } from '../services/audit';
import { sendWithdrawalStatusEmail } from '../services/email';

const VALID_STATUSES: WithdrawalStatus[] = ['pending', 'processing', 'completed', 'failed'];

// ─── Platform stats ───────────────────────────────────────────────────────────
export async function platformStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [users] = await db('users').count('id as total');
    const [activeUsers] = await db('users').where({ is_active: true }).count('id as total');
    const [verifiedUsers] = await db('users').where({ email_verified: true }).count('id as total');
    const [pendingWithdrawals] = await db('withdrawals').where({ status: 'pending' }).count('id as total');
    const [totalPaid] = await db('withdrawals').where({ status: 'completed' }).sum('net_amount as total');
    const [totalEarnings] = await db('earnings').sum('amount as total');

    res.json({
      users: Number(users.total),
      active_users: Number(activeUsers.total),
      verified_users: Number(verifiedUsers.total),
      pending_withdrawals: Number(pendingWithdrawals.total),
      total_paid_out: Number(totalPaid.total ?? 0),
      total_earnings_distributed: Number(totalEarnings.total ?? 0),
    });
  } catch (err) { next(err); }
}

// ─── User management ──────────────────────────────────────────────────────────
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = 50;
    const offset = (page - 1) * limit;
    const search = String(req.query.search ?? '').trim();

    let query = db<DbUser>('users')
      .select('id', 'name', 'email', 'balance', 'is_active', 'is_admin', 'email_verified', 'created_at', 'last_login_at')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (search) {
      query = query.where((b) => {
        b.whereILike('email', `%${search}%`).orWhereILike('name', `%${search}%`);
      });
    }

    const [rows, [count]] = await Promise.all([
      query,
      db('users').count('id as total').modify((q) => {
        if (search) q.where((b) => { b.whereILike('email', `%${search}%`).orWhereILike('name', `%${search}%`); });
      }),
    ]);

    res.json({ users: rows, total: Number(count.total), page, pages: Math.ceil(Number(count.total) / limit) });
  } catch (err) { next(err); }
}

export async function toggleUserActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number(req.params.id);
    if (userId === req.user!.id) { res.status(400).json({ message: 'Cannot deactivate your own account.' }); return; }

    const user = await db<DbUser>('users').where({ id: userId }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const newState = !user.is_active;
    await db('users').where({ id: userId }).update({ is_active: newState });
    await logAudit(req.user!.id, newState ? 'admin_activate_user' : 'admin_deactivate_user', req, { metadata: { target_user_id: userId } });

    res.json({ message: `User ${newState ? 'activated' : 'deactivated'}.`, is_active: newState });
  } catch (err) { next(err); }
}

// ─── Withdrawal management ────────────────────────────────────────────────────
export async function listWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = 50;
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    let query = db('withdrawals as w')
      .join('users as u', 'w.user_id', 'u.id')
      .select(
        'w.id', 'w.amount', 'w.fee', 'w.net_amount', 'w.channel',
        'w.account_number', 'w.status', 'w.created_at',
        'u.id as user_id', 'u.name as user_name', 'u.email as user_email'
      )
      .orderBy('w.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (status && VALID_STATUSES.includes(status as WithdrawalStatus)) {
      query = query.where('w.status', status);
    }

    const [rows, [count]] = await Promise.all([
      query,
      db('withdrawals').count('id as total').modify((q) => {
        if (status && VALID_STATUSES.includes(status as WithdrawalStatus)) q.where({ status });
      }),
    ]);

    res.json({ withdrawals: rows, total: Number(count.total), page, pages: Math.ceil(Number(count.total) / limit) });
  } catch (err) { next(err); }
}

export async function updateWithdrawalStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const withdrawalId = Number(req.params.id);
    const { status } = req.body as { status: string };

    if (!VALID_STATUSES.includes(status as WithdrawalStatus)) {
      res.status(400).json({ message: 'Invalid status.' });
      return;
    }

    const withdrawal = await db<DbWithdrawal>('withdrawals').where({ id: withdrawalId }).first();
    if (!withdrawal) { res.status(404).json({ message: 'Withdrawal not found.' }); return; }
    if (withdrawal.status === status) { res.status(400).json({ message: 'Status is already the same.' }); return; }

    const prevStatus = withdrawal.status;

    await db.transaction(async (trx) => {
      await trx('withdrawals').where({ id: withdrawalId }).update({ status });

      // Refund balance if transitioning to failed
      if (status === 'failed' && prevStatus !== 'failed') {
        await trx('users').where({ id: withdrawal.user_id }).increment('balance', Number(withdrawal.amount));
      }
      // Undo refund if re-activating from failed (admin corrects a mistake)
      if (prevStatus === 'failed' && status !== 'failed') {
        await trx('users').where({ id: withdrawal.user_id }).decrement('balance', Number(withdrawal.amount));
      }
    });

    await logAudit(req.user!.id, 'admin_withdrawal_status_update', req, {
      amount: Number(withdrawal.amount),
      metadata: { withdrawal_id: withdrawalId, prev_status: prevStatus, new_status: status },
    });

    // Notify user when withdrawal is completed or failed (fire-and-forget)
    if (status === 'completed' || status === 'failed') {
      const owner = await db<DbUser>('users').where({ id: withdrawal.user_id }).select('email', 'name').first();
      if (owner) {
        sendWithdrawalStatusEmail(
          owner.email, owner.name, status,
          Number(withdrawal.amount), withdrawal.channel, Number(withdrawal.net_amount)
        ).catch(() => {});
      }
    }

    res.json({ message: 'Withdrawal status updated.', status });
  } catch (err) { next(err); }
}

// ─── Task management ──────────────────────────────────────────────────────────
const VALID_TASK_CATEGORIES = ['survey', 'app_install', 'video', 'microjob', 'game'] as const;
type TaskCategory = typeof VALID_TASK_CATEGORIES[number];

export async function listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasks = await db('tasks').orderBy('created_at', 'desc');
    res.json(tasks);
  } catch (err) { next(err); }
}

export async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, description, category, payout } = req.body as {
      title: string; description: string; category: string; payout: string | number;
    };
    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ message: 'Title and description are required.' }); return;
    }
    if (!VALID_TASK_CATEGORIES.includes(category as TaskCategory)) {
      res.status(400).json({ message: 'Invalid category.' }); return;
    }
    const parsedPayout = parseFloat(String(payout));
    if (isNaN(parsedPayout) || parsedPayout < 1 || parsedPayout > 500) {
      res.status(400).json({ message: 'Payout must be between ₱1 and ₱500.' }); return;
    }

    const [task] = await db('tasks').insert({
      title: title.trim(), description: description.trim(),
      category, payout: parsedPayout, is_active: true,
    }).returning('*');

    await logAudit(req.user!.id, 'admin_create_task', req, { metadata: { task_id: task.id } });
    res.status(201).json(task);
  } catch (err) { next(err); }
}

export async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const taskId = Number(req.params.id);
    const { title, description, category, payout, is_active } = req.body as {
      title?: string; description?: string; category?: string; payout?: string | number; is_active?: boolean;
    };

    const task = await db('tasks').where({ id: taskId }).first();
    if (!task) { res.status(404).json({ message: 'Task not found.' }); return; }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (category !== undefined) {
      if (!VALID_TASK_CATEGORIES.includes(category as TaskCategory)) {
        res.status(400).json({ message: 'Invalid category.' }); return;
      }
      updates.category = category;
    }
    if (payout !== undefined) {
      const p = parseFloat(String(payout));
      if (isNaN(p) || p < 1 || p > 500) { res.status(400).json({ message: 'Payout must be between ₱1 and ₱500.' }); return; }
      updates.payout = p;
    }
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    const [updated] = await db('tasks').where({ id: taskId }).update(updates).returning('*');
    await logAudit(req.user!.id, 'admin_update_task', req, { metadata: { task_id: taskId } });
    res.json(updated);
  } catch (err) { next(err); }
}

// ─── Audit logs ───────────────────────────────────────────────────────────────
export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = 100;
    const offset = (page - 1) * limit;

    const [rows, [count]] = await Promise.all([
      db('audit_logs as a')
        .leftJoin('users as u', 'a.user_id', 'u.id')
        .select('a.id', 'a.action', 'a.amount', 'a.ip_address', 'a.metadata', 'a.created_at', 'u.name as user_name', 'u.email as user_email')
        .orderBy('a.created_at', 'desc')
        .limit(limit)
        .offset(offset),
      db('audit_logs').count('id as total'),
    ]);

    res.json({ logs: rows, total: Number(count.total), page, pages: Math.ceil(Number(count.total) / limit) });
  } catch (err) { next(err); }
}
