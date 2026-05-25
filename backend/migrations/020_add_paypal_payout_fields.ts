import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('withdrawals', (t) => {
    t.string('paypal_batch_id', 64).nullable();
    t.string('paypal_payout_item_id', 64).nullable();
    t.timestamp('payout_attempted_at').nullable();
    t.text('payout_error').nullable();
    t.index('paypal_batch_id');
    t.index('paypal_payout_item_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('withdrawals', (t) => {
    t.dropColumn('paypal_batch_id');
    t.dropColumn('paypal_payout_item_id');
    t.dropColumn('payout_attempted_at');
    t.dropColumn('payout_error');
  });
}
