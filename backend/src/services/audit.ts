import db from '../../config/database';

export async function logAudit(
  userId: number,
  action: string,
  req: { ip?: string; headers: Record<string, string | string[] | undefined> },
  opts: { amount?: number; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;
    await db('audit_logs').insert({
      user_id: userId,
      action,
      amount: opts.amount ?? null,
      ip_address: ip,
      user_agent: userAgent,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
    });
  } catch {
    // Audit log failure must never crash the main flow
  }
}

export async function logLoginEvent(
  userId: number,
  success: boolean,
  req: { ip?: string; headers: Record<string, string | string[] | undefined> }
): Promise<void> {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;
    await db('login_events').insert({ user_id: userId, success, ip_address: ip, user_agent: userAgent });
  } catch {
    // Never crash on audit failure
  }
}
