import type { Knex } from 'knex';

// Lower the credit conversion rate from ₱25 to ₱10 per withdrawal credit.
// Updates the existing seeded site_settings row (migration 026 only affects
// fresh installs, so existing databases need this one-off update).
export async function up(knex: Knex): Promise<void> {
  await knex('site_settings')
    .where({ key: 'credit_php_per_credit' })
    .update({ value: '10', updated_at: knex.fn.now() });
}

export async function down(knex: Knex): Promise<void> {
  await knex('site_settings')
    .where({ key: 'credit_php_per_credit' })
    .update({ value: '25', updated_at: knex.fn.now() });
}
