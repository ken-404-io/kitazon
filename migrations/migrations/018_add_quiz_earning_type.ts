import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_type_check;
    ALTER TABLE earnings ADD CONSTRAINT earnings_type_check
      CHECK (type IN ('task', 'referral_signup', 'referral_commission', 'spin', 'checkin', 'referral', 'quiz'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_type_check;
    ALTER TABLE earnings ADD CONSTRAINT earnings_type_check
      CHECK (type IN ('task', 'referral_signup', 'referral_commission', 'spin', 'checkin', 'referral'));
  `);
}
