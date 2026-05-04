import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('referrals', (t) => {
    t.increments('id').primary();
    t.integer('referrer_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('referred_id').notNullable().references('id').inTable('users').onDelete('CASCADE').unique();
    t.decimal('commission_earned', 12, 2).notNullable().defaultTo(0);
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('referrals');
}
