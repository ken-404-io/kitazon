import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('withdrawals', (t) => {
    t.string('plan_at_withdrawal', 20).nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('withdrawals', (t) => {
    t.dropColumn('plan_at_withdrawal');
  });
}
