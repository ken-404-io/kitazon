import type { Knex } from 'knex';

// The earnings.type column was created with Knex .enu() WITHOUT useNative:true,
// so it's a VARCHAR + CHECK constraint (not a PostgreSQL named enum type).
// We drop the old check and add a new one that includes 'affiliate_offer'.
export async function up(knex: Knex): Promise<void> {
  // Drop the existing check constraint and replace it with one that includes the new value.
  // Knex names the constraint <table>_<column>_check by default.
  await knex.raw(`
    ALTER TABLE earnings
      DROP CONSTRAINT IF EXISTS earnings_type_check,
      ADD CONSTRAINT earnings_type_check
        CHECK (type IN ('task','referral_signup','referral_commission','spin','affiliate_offer'))
  `);

  // Track completed offers to prevent duplicate credits
  await knex.schema.createTable('affiliate_completions', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('network', 50).notNullable();
    t.string('offer_id', 120).notNullable();
    t.string('transaction_id', 120).nullable();
    t.decimal('payout_usd', 10, 4).notNullable();
    t.decimal('credited_php', 10, 2).notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['network', 'offer_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('affiliate_completions');
  await knex.raw(`
    ALTER TABLE earnings
      DROP CONSTRAINT IF EXISTS earnings_type_check,
      ADD CONSTRAINT earnings_type_check
        CHECK (type IN ('task','referral_signup','referral_commission','spin'))
  `);
}
