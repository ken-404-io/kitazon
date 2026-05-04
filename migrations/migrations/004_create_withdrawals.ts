import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('withdrawals', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.decimal('amount', 10, 2).notNullable();
    t.decimal('fee', 10, 2).notNullable().defaultTo(0);
    t.decimal('net_amount', 10, 2).notNullable();
    t.enu('channel', ['gcash', 'maya', 'gotyme', 'bpi', 'bdo', 'unionbank', 'coins', 'usdt']).notNullable();
    t.string('account_number').notNullable();
    t.enu('status', ['pending', 'processing', 'completed', 'failed']).notNullable().defaultTo('pending');
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('withdrawals');
}
