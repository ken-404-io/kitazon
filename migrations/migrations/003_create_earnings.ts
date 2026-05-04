import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('earnings', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('task_id').nullable().references('id').inTable('tasks').onDelete('SET NULL');
    t.decimal('amount', 10, 2).notNullable();
    t.enu('type', ['task', 'referral_signup', 'referral_commission', 'spin']).notNullable();
    t.string('description');
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('earnings');
}
