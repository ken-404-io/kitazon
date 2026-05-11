import type { Knex } from 'knex';

// Adds 'checkin' and 'referral' to the earnings type enum.
// PostgreSQL enums can't be altered in place — we drop the CHECK constraint
// and recreate it with the expanded list of allowed values.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE earnings
      DROP CONSTRAINT IF EXISTS earnings_type_check;

    ALTER TABLE earnings
      ADD CONSTRAINT earnings_type_check
        CHECK (type IN ('task', 'referral_signup', 'referral_commission', 'spin', 'checkin', 'referral'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE earnings
      DROP CONSTRAINT IF EXISTS earnings_type_check;

    ALTER TABLE earnings
      ADD CONSTRAINT earnings_type_check
        CHECK (type IN ('task', 'referral_signup', 'referral_commission', 'spin'));
  `);
}
