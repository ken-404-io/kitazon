import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser, DbWithdrawal, WithdrawalStatus, UserPlan } from '../types';
import { logAudit } from '../services/audit';
import { sendWithdrawalStatusEmail, sendBroadcastEmail, sendPlanUpgradeEmail, sendGcashPaymentRejectedEmail } from '../services/email';

// Maximum withdrawals approvable in a single bulk approve call. Throttling at
// 5s per email means a batch of 100 takes ~8 minutes, so keep the cap modest.
const BULK_APPROVE_MAX = 100;
const BULK_APPROVE_EMAIL_GAP_MS = 5000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
    const [pendingKyc] = await db('kyc_submissions').where({ status: 'pending' }).count('id as total');
    const [pendingGcash] = await db('gcash_payments').where({ status: 'pending' }).count('id as total');

    res.json({
      users: Number(users.total),
      active_users: Number(activeUsers.total),
      verified_users: Number(verifiedUsers.total),
      pending_withdrawals: Number(pendingWithdrawals.total),
      total_paid_out: Number(totalPaid.total ?? 0),
      total_earnings_distributed: Number(totalEarnings.total ?? 0),
      pending_kyc: Number(pendingKyc.total ?? 0),
      pending_gcash: Number(pendingGcash.total ?? 0),
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
      .select('id', 'name', 'email', 'balance', 'is_active', 'is_admin', 'email_verified', 'created_at', 'last_login_at', 'plan', 'plan_expires_at', 'withdrawal_credits')
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
    const search = (req.query.search as string | undefined)?.trim() ?? '';

    let query = db('withdrawals as w')
      .join('users as u', 'w.user_id', 'u.id')
      .select(
        'w.id', 'w.amount', 'w.fee', 'w.net_amount', 'w.channel',
        'w.account_number', 'w.account_name', 'w.status', 'w.created_at',
        'u.id as user_id', 'u.name as user_name', 'u.email as user_email', 'u.plan as user_plan'
      )
      .orderBy('w.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (status && VALID_STATUSES.includes(status as WithdrawalStatus)) {
      query = query.where('w.status', status);
    }
    if (search) {
      query = query.where(function () {
        this.whereILike('u.name', `%${search}%`)
            .orWhereILike('u.email', `%${search}%`)
            .orWhereILike('w.account_number', `%${search}%`)
            .orWhereILike('w.account_name', `%${search}%`);
      });
    }

    const [rows, [count]] = await Promise.all([
      query,
      db('withdrawals as w').join('users as u', 'w.user_id', 'u.id').count('w.id as total').modify((q) => {
        if (status && VALID_STATUSES.includes(status as WithdrawalStatus)) q.where('w.status', status);
        if (search) q.where(function () {
          this.whereILike('u.name', `%${search}%`)
              .orWhereILike('u.email', `%${search}%`)
              .orWhereILike('w.account_number', `%${search}%`)
              .orWhereILike('w.account_name', `%${search}%`);
        });
      }),
    ]);

    // Compute daily completed withdrawal count per user, resetting at midnight PH time (UTC+8).
    const userIds = [...new Set((rows as Array<{ user_id: number }>).map((r) => r.user_id))];
    let dailyCountMap = new Map<number, number>();
    if (userIds.length > 0) {
      // Start of today in PH time expressed as a UTC Date
      const nowUtc = new Date();
      const phOffsetMs = 8 * 60 * 60 * 1000;
      const nowPh = new Date(nowUtc.getTime() + phOffsetMs);
      const todayPhDateStr = nowPh.toISOString().slice(0, 10); // 'YYYY-MM-DD'
      const todayPhStartUtc = new Date(`${todayPhDateStr}T00:00:00+08:00`);

      const dailyCounts = await db('withdrawals')
        .whereIn('user_id', userIds)
        .where('status', 'completed')
        .where('created_at', '>=', todayPhStartUtc)
        .groupBy('user_id')
        .select('user_id', db.raw('count(*) as daily_completed_count'));

      dailyCountMap = new Map(
        (dailyCounts as Array<{ user_id: number; daily_completed_count: string | number }>)
          .map((r) => [r.user_id, Number(r.daily_completed_count)])
      );
    }

    const enrichedRows = (rows as Array<Record<string, unknown>>).map((r) => ({
      ...r,
      daily_completed_count: dailyCountMap.get(r.user_id as number) ?? 0,
    }));

    res.json({ withdrawals: enrichedRows, total: Number(count.total), page, pages: Math.ceil(Number(count.total) / limit) });
  } catch (err) { next(err); }
}

export async function updateWithdrawalStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const withdrawalId = Number(req.params.id);
    const { status, message } = req.body as { status: string; message?: string };
    const adminMessage =
      typeof message === 'string' && message.trim()
        ? message.trim().slice(0, 1000)
        : null;

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
          Number(withdrawal.amount), withdrawal.channel, Number(withdrawal.net_amount),
          adminMessage,
        ).catch(() => {});
      }
    }

    res.json({ message: 'Withdrawal status updated.', status });
  } catch (err) { next(err); }
}

// ─── Bulk approve withdrawals ─────────────────────────────────────────────────
// Body: { withdrawal_ids: number[] }
// Approves (marks completed) every listed pending/processing withdrawal in a
// single transaction, then notifies each user by email with a 5-second gap
// between sends so Resend's rate limiter doesn't reject the run.
export async function bulkApproveWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { withdrawal_ids: rawIds, message } = req.body as { withdrawal_ids?: unknown; message?: unknown };
    const adminMessage =
      typeof message === 'string' && message.trim()
        ? message.trim().slice(0, 1000)
        : null;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      res.status(400).json({ message: 'No withdrawals selected.' });
      return;
    }
    const ids = rawIds
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      res.status(400).json({ message: 'No valid withdrawal ids provided.' });
      return;
    }
    if (ids.length > BULK_APPROVE_MAX) {
      res.status(400).json({ message: `Cannot approve more than ${BULK_APPROVE_MAX} withdrawals at once.` });
      return;
    }

    // Atomically flip status from pending/processing → completed for the
    // listed ids. Withdrawals that are already completed/failed are skipped.
    const claimed = await db('withdrawals')
      .whereIn('id', ids)
      .whereIn('status', ['pending', 'processing'])
      .update({ status: 'completed' })
      .returning(['id', 'user_id', 'amount', 'net_amount', 'channel']);

    const approvedRows = (claimed ?? []) as Array<{
      id: number;
      user_id: number;
      amount: number | string;
      net_amount: number | string;
      channel: string;
    }>;
    const approvedIds = approvedRows.map((r) => r.id);
    const skipped = ids.filter((id) => !approvedIds.includes(id));

    if (approvedRows.length === 0) {
      res.status(409).json({
        message: 'None of the selected withdrawals are pending or processing.',
        skipped_ids: skipped,
      });
      return;
    }

    await logAudit(req.user!.id, 'admin_bulk_approve_withdrawals', req, {
      amount: approvedRows.reduce((s, r) => s + Number(r.amount), 0),
      metadata: { withdrawal_ids: approvedIds, skipped_ids: skipped, has_message: !!adminMessage },
    });

    // Respond immediately — emails are sent in the background with a 5s gap
    // between each user to stay under the Resend per-second limit.
    res.json({
      message: `Approved ${approvedRows.length} withdrawal${approvedRows.length === 1 ? '' : 's'}.`,
      approved_count: approvedRows.length,
      approved_ids: approvedIds,
      skipped_ids: skipped,
    });

    void (async () => {
      const owners = await db<DbUser>('users')
        .whereIn('id', approvedRows.map((r) => r.user_id))
        .select('id', 'email', 'name');
      const ownerById = new Map(owners.map((u) => [u.id, u]));

      for (let i = 0; i < approvedRows.length; i++) {
        const row = approvedRows[i];
        const owner = ownerById.get(row.user_id);
        if (owner) {
          try {
            await sendWithdrawalStatusEmail(
              owner.email,
              owner.name,
              'completed',
              Number(row.amount),
              row.channel,
              Number(row.net_amount),
              adminMessage,
            );
          } catch (emailErr) {
            console.error('[Bulk Approve] email send failed', { withdrawal_id: row.id, error: (emailErr as Error).message });
          }
        }
        if (i < approvedRows.length - 1) await sleep(BULK_APPROVE_EMAIL_GAP_MS);
      }
    })();
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

export async function bulkImportTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tasks } = req.body as {
      tasks?: Array<{ title?: unknown; description?: unknown; category?: unknown; payout?: unknown; url?: unknown; is_active?: unknown }>;
    };

    if (!Array.isArray(tasks) || tasks.length === 0) {
      res.status(400).json({ message: 'tasks must be a non-empty array.' });
      return;
    }
    if (tasks.length > 100) {
      res.status(400).json({ message: 'Cannot import more than 100 tasks at once.' });
      return;
    }

    const toInsert: Array<Record<string, unknown>> = [];
    const errors: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const rowErrors: string[] = [];

      if (!t.title || typeof t.title !== 'string' || !String(t.title).trim()) {
        rowErrors.push('title is required');
      }
      const parsedPayout = parseFloat(String(t.payout ?? ''));
      if (isNaN(parsedPayout) || parsedPayout <= 0) {
        rowErrors.push('payout must be a number > 0');
      }
      if (!VALID_TASK_CATEGORIES.includes(t.category as TaskCategory)) {
        rowErrors.push(`category must be one of: ${VALID_TASK_CATEGORIES.join(', ')}`);
      }

      if (rowErrors.length > 0) {
        errors.push({ index: i, reason: rowErrors.join('; ') });
        continue;
      }

      toInsert.push({
        title: String(t.title).trim(),
        description: t.description ? String(t.description).trim() : '',
        category: t.category,
        payout: parsedPayout,
        url: t.url ? String(t.url).trim() : null,
        is_active: t.is_active !== undefined ? Boolean(t.is_active) : true,
      });
    }

    if (toInsert.length > 0) {
      await db('tasks').insert(toInsert);
    }

    await logAudit(req.user!.id, 'admin_bulk_import_tasks', req, {
      metadata: { imported: toInsert.length, skipped: errors.length },
    });

    res.status(201).json({ imported: toInsert.length, skipped: errors.length, errors });
  } catch (err) { next(err); }
}

// ─── Plan management ──────────────────────────────────────────────────────────
const VALID_PLANS: UserPlan[] = ['free', 'bronze', 'silver', 'gold', 'diamond'];

export async function updateUserPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number(req.params.id);
    const { plan, plan_expires_at } = req.body as { plan?: string; plan_expires_at?: string };

    if (!plan || !VALID_PLANS.includes(plan as UserPlan)) {
      res.status(400).json({ message: 'Invalid plan. Must be one of: free, bronze, silver, gold, diamond.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: userId }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    let expiresAt: Date | null;
    if (plan === 'free') {
      expiresAt = null;
    } else if (plan_expires_at) {
      expiresAt = new Date(plan_expires_at);
      if (isNaN(expiresAt.getTime())) {
        res.status(400).json({ message: 'Invalid plan_expires_at date.' });
        return;
      }
    } else {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await db<DbUser>('users').where({ id: userId }).update({
      plan: plan as UserPlan,
      plan_expires_at: expiresAt,
    });

    await logAudit(req.user!.id, 'admin_update_user_plan', req, {
      metadata: { target_user_id: userId, plan, plan_expires_at: expiresAt },
    });

    const updated = await db<DbUser>('users')
      .where({ id: userId })
      .select('id', 'name', 'email', 'plan', 'plan_expires_at', 'is_active', 'balance')
      .first();

    res.json({ message: 'User plan updated.', user: updated });
  } catch (err) { next(err); }
}

// ─── Balance adjustment ───────────────────────────────────────────────────────
export async function adjustBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number(req.params.id);
    const { amount, note } = req.body as { amount: unknown; note: unknown };

    if (typeof amount !== 'number' || isNaN(amount) || amount === 0 || amount < -100000 || amount > 100000) {
      res.status(400).json({ message: 'amount must be a non-zero number between -100000 and 100000.' });
      return;
    }
    if (!note || typeof note !== 'string' || !String(note).trim()) {
      res.status(400).json({ message: 'note is required.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: userId }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    if (amount < 0 && Number(user.balance) + amount < 0) {
      res.status(400).json({ message: 'Insufficient balance. Cannot go below zero.' });
      return;
    }

    let updatedBalance: number;
    await db.transaction(async (trx) => {
      if (amount > 0) {
        await trx<DbUser>('users').where({ id: userId }).increment('balance', amount);
      } else {
        await trx<DbUser>('users').where({ id: userId }).decrement('balance', Math.abs(amount));
      }
      await trx('earnings').insert({
        user_id: userId,
        task_id: null,
        amount,
        type: 'admin_adjustment',
        description: String(note).trim(),
      });
      const [updated] = await trx<DbUser>('users').where({ id: userId }).select('balance');
      updatedBalance = Number(updated.balance);
    });

    await logAudit(req.user!.id, 'admin_balance_adjustment', req, {
      amount,
      metadata: { target_user_id: userId, amount, note: String(note).trim() },
    });

    res.json({ message: 'Balance adjusted.', balance: updatedBalance! });
  } catch (err) { next(err); }
}

// ─── Broadcast email ──────────────────────────────────────────────────────────
export async function broadcastEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { subject, message, target } = req.body as { subject: unknown; message: unknown; target: unknown };

    if (!subject || typeof subject !== 'string' || !String(subject).trim()) {
      res.status(400).json({ message: 'subject is required.' }); return;
    }
    if (!message || typeof message !== 'string' || !String(message).trim()) {
      res.status(400).json({ message: 'message is required.' }); return;
    }
    if (!target || !['all', 'verified', 'paid'].includes(String(target))) {
      res.status(400).json({ message: 'target must be one of: all, verified, paid.' }); return;
    }
    if (String(subject).trim().length > 200) {
      res.status(400).json({ message: 'subject must be 200 characters or fewer.' }); return;
    }
    if (String(message).trim().length > 2000) {
      res.status(400).json({ message: 'message must be 2000 characters or fewer.' }); return;
    }

    let query = db<DbUser>('users').where({ is_active: true }).select('email', 'name').limit(500);

    if (target === 'verified') {
      query = query.where({ email_verified: true });
    } else if (target === 'paid') {
      query = query.whereNot({ plan: 'free' });
    }

    const users = await query;

    const subjectStr = String(subject).trim();
    const messageStr = String(message).trim();

    // Fire-and-forget
    Promise.allSettled(
      users.map((u) => sendBroadcastEmail(u.email, u.name, subjectStr, messageStr))
    ).catch(() => {});

    await logAudit(req.user!.id, 'admin_broadcast_email', req, {
      metadata: { target, subject: subjectStr, recipient_count: users.length },
    });

    res.json({ queued: users.length });
  } catch (err) { next(err); }
}

// ─── Revenue stats ────────────────────────────────────────────────────────────
const PLAN_PRICES: Record<string, number> = { silver: 99, gold: 199, diamond: 399 };

export async function revenueStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Plan upgrade audit log entries — approximate revenue
    const upgradeRows = await db('audit_logs')
      .where({ action: 'plan_upgrade' })
      .select('metadata');

    let subscriptionRevenue = 0;
    for (const row of upgradeRows) {
      let meta: Record<string, unknown> = {};
      try {
        meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {});
      } catch { /* skip */ }
      const plan = String(meta.plan ?? '');
      subscriptionRevenue += PLAN_PRICES[plan] ?? 0;
    }

    const [planBreakdownRows, totalWithdrawals, totalEarnings, newUsers, activeSubscribers] = await Promise.all([
      db<DbUser>('users').select('plan').count('id as cnt').groupBy('plan'),
      db('withdrawals').where({ status: 'completed' }).sum('net_amount as total').first(),
      db('earnings').sum('amount as total').first(),
      db<DbUser>('users').where('created_at', '>=', thirtyDaysAgo).count('id as total').first(),
      db<DbUser>('users')
        .whereNot({ plan: 'free' })
        .where('plan_expires_at', '>', new Date())
        .count('id as total')
        .first(),
    ]);

    const planBreakdown: Record<string, number> = { free: 0, bronze: 0, silver: 0, gold: 0, diamond: 0 };
    for (const row of planBreakdownRows) {
      planBreakdown[String(row.plan)] = Number((row as unknown as { cnt: unknown }).cnt);
    }

    res.json({
      subscription_revenue: subscriptionRevenue,
      plan_breakdown: planBreakdown,
      total_withdrawals_paid: Number(totalWithdrawals?.total ?? 0),
      total_earnings_distributed: Number(totalEarnings?.total ?? 0),
      new_users_30d: Number((newUsers as unknown as { total: unknown } | undefined)?.total ?? 0),
      active_subscribers: Number((activeSubscribers as unknown as { total: unknown } | undefined)?.total ?? 0),
    });
  } catch (err) { next(err); }
}

// ─── Leaderboard rewards ──────────────────────────────────────────────────────
const LEADERBOARD_BONUSES: Record<number, number> = { 1: 500, 2: 200, 3: 100 };

export async function grantLeaderboardRewards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Query top 3 earners for current month
    const topEarners = await db('earnings as e')
      .join('users as u', 'e.user_id', 'u.id')
      .where('e.created_at', '>=', monthStart)
      .where('e.created_at', '<', monthEnd)
      .select('e.user_id', 'u.name', db.raw('SUM(e.amount) as total_earned'))
      .groupBy('e.user_id', 'u.name')
      .orderBy('total_earned', 'desc')
      .limit(3);

    const winners: Array<{ rank: number; name: string; amount_earned: number; bonus_granted: number }> = [];

    for (let i = 0; i < topEarners.length; i++) {
      const rank = i + 1;
      const earner = topEarners[i] as { user_id: number; name: string; total_earned: string };
      const bonus = LEADERBOARD_BONUSES[rank];
      if (!bonus) continue;

      await db.transaction(async (trx) => {
        await trx('earnings').insert({
          user_id: earner.user_id,
          task_id: null,
          amount: bonus,
          type: 'admin_adjustment',
          description: `Leaderboard reward — Rank #${rank} (${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()})`,
        });
        await trx('users').where({ id: earner.user_id }).increment('balance', bonus);
      });

      await logAudit(req.user!.id, 'admin_leaderboard_reward', req, {
        amount: bonus,
        metadata: { rank, target_user_id: earner.user_id, bonus_granted: bonus },
      });

      winners.push({
        rank,
        name: earner.name,
        amount_earned: parseFloat(earner.total_earned),
        bonus_granted: bonus,
      });
    }

    res.json({ winners });
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

// ─── Online users ─────────────────────────────────────────────────────────────
export async function listOnlineUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const threshold = new Date(Date.now() - 5 * 60 * 1000); // active in last 5 minutes
    const rows = await db('users')
      .where('last_active_at', '>=', threshold)
      .select('id', 'name', 'email', 'plan', 'last_active_at')
      .orderBy('last_active_at', 'desc');

    res.json({ count: rows.length, users: rows });
  } catch (err) { next(err); }
}

// ─── GCash Payments ───────────────────────────────────────────────────────────
export async function listGcashPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'pending' } = req.query as { status?: string };
    const rows = await db('gcash_payments as g')
      .join('users as u', 'u.id', 'g.user_id')
      .where('g.status', status)
      .orderBy('g.created_at', 'desc')
      .select(
        'g.id', 'g.user_id', 'g.plan', 'g.amount', 'g.reference',
        'g.screenshot_url', 'g.status', 'g.admin_note', 'g.created_at',
        'u.name as user_name', 'u.email as user_email',
      );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function approveGcashPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const payment = await db('gcash_payments').where({ id }).first();
    if (!payment) { res.status(404).json({ message: 'Payment not found.' }); return; }
    if (payment.status !== 'pending') {
      res.status(409).json({ message: 'Payment already reviewed.' }); return;
    }

    const PLAN_DURATION_DAYS = 30;
    const expiresAt = new Date(Date.now() + PLAN_DURATION_DAYS * 24 * 3600 * 1000);

    await db.transaction(async (trx) => {
      await trx('gcash_payments').where({ id }).update({
        status: 'approved',
        reviewed_by: req.user!.id,
        updated_at: new Date(),
      });
      await trx('users').where({ id: payment.user_id }).update({
        plan: payment.plan,
        plan_expires_at: expiresAt,
      });
    });

    await logAudit(req.user!.id, 'gcash_payment_approved', req, {
      metadata: { payment_id: id, user_id: payment.user_id, plan: payment.plan },
    });

    const user = await db<DbUser>('users').where({ id: payment.user_id }).select('email', 'name').first();
    if (user) sendPlanUpgradeEmail(user.email, user.name, payment.plan, expiresAt)
      .catch((err) => console.error('[GCash Approve] User email failed:', err?.message ?? err));

    res.json({ message: 'Payment approved and plan activated.' });
  } catch (err) { next(err); }
}

export async function rejectGcashPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { note } = req.body as { note?: string };

    const payment = await db('gcash_payments').where({ id }).first();
    if (!payment) { res.status(404).json({ message: 'Payment not found.' }); return; }
    if (payment.status !== 'pending') {
      res.status(409).json({ message: 'Payment already reviewed.' }); return;
    }

    await db('gcash_payments').where({ id }).update({
      status: 'rejected',
      admin_note: note?.trim() ?? null,
      reviewed_by: req.user!.id,
      updated_at: new Date(),
    });

    await logAudit(req.user!.id, 'gcash_payment_rejected', req, {
      metadata: { payment_id: id, user_id: payment.user_id, note },
    });

    const user = await db<DbUser>('users').where({ id: payment.user_id }).select('email', 'name').first();
    if (user) sendGcashPaymentRejectedEmail(user.email, user.name, payment.plan, payment.amount, note?.trim() ?? null)
      .catch((err) => console.error('[GCash Reject] User email failed:', err?.message ?? err));

    res.json({ message: 'Payment rejected.' });
  } catch (err) { next(err); }
}

// ─── Adjust referral count ────────────────────────────────────────────────────
export async function setReferralCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = parseInt(req.params.id, 10);
    const { count } = req.body as { count?: number };

    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      res.status(400).json({ message: 'count must be a non-negative integer.' });
      return;
    }

    const user = await db<DbUser>('users').where({ id: userId }).first();
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    // real referral count
    const row = await db('referrals').where({ referrer_id: userId }).count('id as n').first();
    const realCount = Number((row as { n?: unknown } | undefined)?.n ?? 0);
    const adjustment = count - realCount;

    await db('users').where({ id: userId }).update({ referral_count_adjustment: adjustment });
    await logAudit(req.user!.id, 'admin_set_referral_count', req, {
      metadata: { target_user_id: userId, real_count: realCount, desired_count: count, adjustment },
    });

    res.json({ message: `Referral count set to ${count}.`, referral_count: count });
  } catch (err) { next(err); }
}

// ─── Fraud Detection ──────────────────────────────────────────────────────────
export async function fraudReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Flagged withdrawals
    const flaggedWithdrawals = await db('withdrawals as w')
      .join('users as u', 'w.user_id', 'u.id')
      .where('w.is_flagged', true)
      .orderBy('w.created_at', 'desc')
      .limit(100)
      .select(
        'w.id', 'w.user_id', 'w.amount', 'w.status', 'w.created_at',
        'w.metadata', 'u.name as user_name', 'u.email as user_email',
        'u.is_active'
      ).catch(() => []);

    // 2. Duplicate device fingerprints (multiple accounts sharing same fingerprint)
    const dupDevices = await db('users as u1')
      .join('users as u2', function() {
        this.on('u1.device_fingerprint', '=', 'u2.device_fingerprint')
            .andOn('u1.id', '<', 'u2.id');
      })
      .whereNotNull('u1.device_fingerprint')
      .select(
        'u1.device_fingerprint as fingerprint',
        'u1.id as user1_id', 'u1.name as user1_name', 'u1.email as user1_email',
        'u1.is_active as user1_active', 'u1.created_at as user1_created_at',
        'u2.id as user2_id', 'u2.name as user2_name', 'u2.email as user2_email',
        'u2.is_active as user2_active', 'u2.created_at as user2_created_at',
      )
      .orderBy('u1.created_at', 'desc')
      .limit(100)
      .catch(() => []);

    // 3. Duplicate registration IPs (3+ accounts from same IP)
    const dupIps = await db('users')
      .whereNotNull('registration_ip')
      .select('registration_ip')
      .count('id as cnt')
      .groupBy('registration_ip')
      .havingRaw('COUNT(id) >= 3')
      .orderBy('cnt', 'desc')
      .limit(50)
      .catch(() => []);

    // Enrich duplicate IPs with user list
    const dupIpUsers = await Promise.all(
      (dupIps as { registration_ip: string; cnt: string | number }[]).map(async (row) => {
        const users = await db('users')
          .where('registration_ip', row.registration_ip)
          .select('id', 'name', 'email', 'is_active', 'created_at', 'plan')
          .orderBy('created_at', 'asc');
        return { ip: row.registration_ip, count: Number(row.cnt), users };
      })
    );

    // 4. Fraud referrals (referrer and referred share same device fingerprint or IP)
    const fraudReferrals = await db('referrals as r')
      .join('users as referrer', 'r.referrer_id', 'referrer.id')
      .join('users as referred', 'r.referred_id', 'referred.id')
      .where(function() {
        this.where(function() {
          this.whereNotNull('referrer.device_fingerprint')
              .whereRaw('referrer.device_fingerprint = referred.device_fingerprint');
        }).orWhere(function() {
          this.whereNotNull('referrer.registration_ip')
              .whereRaw('referrer.registration_ip = referred.registration_ip');
        });
      })
      .select(
        'r.id as referral_id', 'r.created_at',
        'referrer.id as referrer_id', 'referrer.name as referrer_name', 'referrer.email as referrer_email',
        'referred.id as referred_id', 'referred.name as referred_name', 'referred.email as referred_email',
        db.raw(`CASE WHEN referrer.device_fingerprint = referred.device_fingerprint THEN true ELSE false END as same_device`),
        db.raw(`CASE WHEN referrer.registration_ip = referred.registration_ip THEN true ELSE false END as same_ip`),
      )
      .orderBy('r.created_at', 'desc')
      .limit(100)
      .catch(() => []);

    res.json({
      flagged_withdrawals: flaggedWithdrawals,
      duplicate_devices: dupDevices,
      duplicate_ips: dupIpUsers,
      fraud_referrals: fraudReferrals,
    });
  } catch (err) { next(err); }
}

// ─── Suspend all fraud accounts ───────────────────────────────────────────────
export async function suspendAllFraud(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sendAccountSuspendedEmail } = await import('../services/email');
    const body = req.body as { reason?: string; user_ids?: number[] };
    const reason = (typeof body.reason === 'string' && body.reason.trim())
      ? body.reason.trim()
      : 'Multiple accounts or fraudulent activity detected on your device or network.';

    const userIds = new Set<number>();

    // If the frontend passes explicit user IDs (per-category suspension), use those directly.
    if (Array.isArray(body.user_ids) && body.user_ids.length > 0) {
      body.user_ids.forEach((id: number) => userIds.add(id));
    } else {
      // Full scan: collect from all three fraud signals.

      // 1. Duplicate device fingerprints
      const dupDevices = await db('users as u1')
        .join('users as u2', function () {
          this.on('u1.device_fingerprint', '=', 'u2.device_fingerprint')
              .andOn('u1.id', '<', 'u2.id');
        })
        .whereNotNull('u1.device_fingerprint')
        .select('u1.id as id1', 'u2.id as id2');
      for (const r of dupDevices as { id1: number; id2: number }[]) {
        userIds.add(r.id1);
        userIds.add(r.id2);
      }

      // 2. Shared registration IPs (3+ accounts)
      const allIpUsers = await db('users')
        .whereNotNull('registration_ip')
        .select('registration_ip', 'id') as { registration_ip: string; id: number }[];
      const ipGroups: Record<string, number[]> = {};
      for (const u of allIpUsers) {
        if (!ipGroups[u.registration_ip]) ipGroups[u.registration_ip] = [];
        ipGroups[u.registration_ip].push(u.id);
      }
      for (const ids of Object.values(ipGroups)) {
        if (ids.length >= 3) ids.forEach(id => userIds.add(id));
      }

      // 3. Fraud referrals — same device or same IP between referrer and referred
      const fraudRefs = await db('referrals as r')
        .join('users as referrer', 'r.referrer_id', 'referrer.id')
        .join('users as referred', 'r.referred_id', 'referred.id')
        .where(function () {
          this.where(function () {
            this.whereNotNull('referrer.device_fingerprint')
                .whereRaw('referrer.device_fingerprint = referred.device_fingerprint');
          }).orWhere(function () {
            this.whereNotNull('referrer.registration_ip')
                .whereRaw('referrer.registration_ip = referred.registration_ip');
          });
        })
        .select('r.referrer_id', 'r.referred_id') as { referrer_id: number; referred_id: number }[];
      for (const r of fraudRefs) {
        userIds.add(r.referrer_id);
        userIds.add(r.referred_id);
      }
    }

    if (userIds.size === 0) { res.json({ suspended: 0 }); return; }

    // Fetch non-admin, currently active targets so we only email/count real changes
    const targets = await db<DbUser>('users')
      .whereIn('id', Array.from(userIds))
      .where({ is_admin: false, is_active: true })
      .select('id', 'name', 'email');

    if (targets.length === 0) { res.json({ suspended: 0 }); return; }

    // Bulk deactivate in one query
    await db('users')
      .whereIn('id', targets.map(u => u.id))
      .update({ is_active: false });

    // Send suspension emails concurrently (failures don't abort the response)
    await Promise.allSettled(
      targets.map(u => sendAccountSuspendedEmail(u.email, u.name, reason))
    );

    await logAudit(req.user!.id, 'admin_suspend_all_fraud', req, {
      metadata: { suspended_ids: targets.map(u => u.id), count: targets.length, reason },
    });

    res.json({ suspended: targets.length, user_ids: targets.map(u => u.id) });
  } catch (err) { next(err); }
}
