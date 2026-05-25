import type { Knex } from 'knex';

// Partial unique index: one task completion per user per task
// Partial unique index: one spin per user per calendar day (UTC)
// These enforce race-condition safety at the database level.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uidx_earnings_user_task
      ON earnings (user_id, task_id)
      WHERE type = 'task'
  `);

  // DATE(timestamptz) is STABLE (timezone-dependent), not IMMUTABLE, so we
  // need an IMMUTABLE wrapper that hard-codes UTC to be usable in an index.
  await knex.raw(`
    CREATE OR REPLACE FUNCTION kitazon_utc_date(ts timestamptz)
    RETURNS date
    LANGUAGE sql
    IMMUTABLE STRICT
    AS $$ SELECT ($1 AT TIME ZONE 'UTC')::date $$
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uidx_earnings_user_spin_day
      ON earnings (user_id, kitazon_utc_date(created_at))
      WHERE type = 'spin'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS uidx_earnings_user_task');
  await knex.raw('DROP INDEX IF EXISTS uidx_earnings_user_spin_day');
  await knex.raw('DROP FUNCTION IF EXISTS kitazon_utc_date(timestamptz)');
}
