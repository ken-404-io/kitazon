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

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uidx_earnings_user_spin_day
      ON earnings (user_id, DATE(created_at))
      WHERE type = 'spin'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS uidx_earnings_user_task');
  await knex.raw('DROP INDEX IF EXISTS uidx_earnings_user_spin_day');
}
