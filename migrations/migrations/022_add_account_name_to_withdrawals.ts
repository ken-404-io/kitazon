import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('withdrawals', (t) => {
    t.string('account_name').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('withdrawals', (t) => {
    t.dropColumn('account_name');
  });
}
