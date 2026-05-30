import type { Knex } from 'knex';

// Admin balance adjustments write an `earnings` row with type 'admin_adjustment',
// but that value was missing from the earnings_type_check CHECK constraint, so the
// insert (and therefore the whole adjustment) failed. Add it to the allowed set.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_type_check;
    ALTER TABLE earnings ADD CONSTRAINT earnings_type_check
      CHECK (type IN ('task', 'referral_signup', 'referral_commission', 'spin', 'checkin', 'referral', 'quiz', 'welcome_bonus', 'admin_adjustment'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE earnings DROP CONSTRAINT IF EXISTS earnings_type_check;
    ALTER TABLE earnings ADD CONSTRAINT earnings_type_check
      CHECK (type IN ('task', 'referral_signup', 'referral_commission', 'spin', 'checkin', 'referral', 'quiz', 'welcome_bonus'));
  `);
}
