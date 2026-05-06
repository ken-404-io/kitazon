import type { Knex } from 'knex';

// Extend earnings type enum to include affiliate offers.
// Knex creates a named PostgreSQL enum type for .enu() columns.
// We add the new value and create the affiliate_completions dedup table.
export async function up(knex: Knex): Promise<void> {
  // Extend enum safely
  await knex.raw(`ALTER TYPE earnings_type ADD VALUE IF NOT EXISTS 'affiliate_offer'`);

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
  // PostgreSQL does not support removing enum values — leave type as-is on rollback
}
