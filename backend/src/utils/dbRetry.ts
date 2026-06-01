// Transient database errors — typically Neon serverless waking a scaled-to-zero
// compute or briefly losing its pageserver connection — surface as short-lived
// failures that succeed on a retry a moment later. Examples seen in production:
//   [NEON_SMGR] [shard 0] could not establish connection to pageserver
//   Connection terminated unexpectedly / ECONNRESET / ETIMEDOUT
// Rather than 500 the user on these, retry a few times with backoff.

const TRANSIENT_PATTERNS = [
  'could not establish connection to pageserver',
  'neon_smgr',
  'connection terminated',
  'connection reset',
  'server closed the connection',
  'timeout',
  'econnreset',
  'econnrefused',
  'etimedout',
  'enotfound',
  'too many connections',
  // Neon proxy throttling concurrent connection establishment during a spike or
  // cold start. These are short-lived and clear once the compute finishes
  // scaling, so they're safe to retry with backoff rather than 500.
  'too many database connection attempts',
  'failed to acquire permit',
  // Postgres server-side connection-slot exhaustion (FATAL 53300 / 53400).
  'too many clients already',
  'remaining connection slots are reserved',
  // Knex/tarn pool ran out of room to hand out a connection in time.
  'timeout acquiring a connection',
  'the database system is starting up',
  'terminating connection due to administrator command',
];

function isTransientDbError(err: unknown): boolean {
  if (!err) return false;
  const message = `${(err as { message?: string }).message ?? ''} ${String(err)}`.toLowerCase();
  if (TRANSIENT_PATTERNS.some((p) => message.includes(p))) return true;

  // pg SQLSTATE codes: connection class (08xxx), insufficient resources such as
  // too_many_connections (53xxx), and admin shutdown (57P0x).
  const code = (err as { code?: string }).code;
  if (
    typeof code === 'string' &&
    (code.startsWith('08') || code.startsWith('53') || code.startsWith('57P'))
  ) {
    return true;
  }

  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a database operation, retrying transient connection failures with
 * exponential backoff. Non-transient errors (e.g. unique-constraint violations)
 * are thrown immediately so they keep their normal handling.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 200, label = 'db operation' }: { retries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isTransientDbError(err)) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(`[dbRetry] transient failure on ${label} (attempt ${attempt}/${retries}), retrying in ${delay}ms:`, (err as { message?: string }).message ?? err);
      await sleep(delay);
    }
  }
}

export { isTransientDbError };
