import db from '../config/database';

// Production's knex migration history is out of sync with the migration files,
// so replaying migrations is unsafe (knex tries to re-run old ones and fails).
// Instead, idempotently ensure exactly the schema the app needs. Every step is
// safe to run on every boot and is isolated so one failure can't block another.

const REQUIRED_EARNING_TYPES = [
  'task', 'referral_signup', 'referral_commission', 'spin', 'checkin', 'referral', 'quiz', 'welcome_bonus',
];

async function ensureNotificationsTable(): Promise<void> {
  await db.raw(`
    CREATE TABLE IF NOT EXISTS notifications (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type varchar(50) NOT NULL DEFAULT 'broadcast',
      title varchar(200) NOT NULL,
      message text NOT NULL,
      read_at timestamptz NULL DEFAULT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.raw('CREATE INDEX IF NOT EXISTS notifications_user_unread ON notifications (user_id, read_at)');
}

async function ensureWelcomeBonusSchema(): Promise<void> {
  await db.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_bonus_claimed_at timestamptz');

  // Build the allowed-type list as a superset of what's required AND whatever
  // already exists, so the new constraint can never be violated by current data.
  const existing: string[] = await db('earnings').distinct('type').pluck('type');
  const safe = existing.filter((t) => typeof t === 'string' && /^[a-z_]+$/.test(t));
  if (safe.length !== existing.length) {
    console.warn('[schema] earnings has unexpected type values; skipping constraint update to avoid breakage');
    return;
  }
  const allowed = Array.from(new Set([...REQUIRED_EARNING_TYPES, ...safe]));
  const list = allowed.map((t) => `'${t}'`).join(', ');

  await db.transaction(async (trx) => {
    await trx.raw('ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_type_check');
    await trx.raw(`ALTER TABLE earnings ADD CONSTRAINT earnings_type_check CHECK (type IN (${list}))`);
  });
}

async function ensureKitaGrowSchema(): Promise<void> {
  await db.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS kitagrow_balance numeric(12,2) NOT NULL DEFAULT 0');

  await db.raw(`
    CREATE TABLE IF NOT EXISTS investments (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      term_days integer NOT NULL,
      amount numeric(12,2) NOT NULL,
      payout_amount numeric(12,2) NOT NULL,
      reference varchar(100) NOT NULL,
      screenshot_url text NULL,
      status varchar(20) NOT NULL DEFAULT 'pending',
      admin_note text NULL,
      reviewed_by integer NULL REFERENCES users(id) ON DELETE SET NULL,
      activated_at timestamptz NULL,
      matures_at timestamptz NULL,
      paid_out_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.raw('CREATE INDEX IF NOT EXISTS investments_user_status ON investments (user_id, status)');
  await db.raw('CREATE INDEX IF NOT EXISTS investments_status_mature ON investments (status, matures_at)');

  await db.raw(`
    CREATE TABLE IF NOT EXISTS kitagrow_withdrawals (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount numeric(12,2) NOT NULL,
      channel varchar(20) NOT NULL DEFAULT 'gcash',
      account_number varchar(30) NOT NULL,
      account_name varchar(100) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'pending',
      admin_note text NULL,
      reviewed_by integer NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.raw('CREATE INDEX IF NOT EXISTS kitagrow_withdrawals_user_status ON kitagrow_withdrawals (user_id, status)');
}

export async function ensureSchema(): Promise<void> {
  for (const step of [ensureNotificationsTable, ensureWelcomeBonusSchema, ensureKitaGrowSchema]) {
    try {
      await step();
    } catch (err) {
      console.error(`[schema] ${step.name} failed:`, err);
    }
  }
  console.log('[schema] schema ensure complete');
}
