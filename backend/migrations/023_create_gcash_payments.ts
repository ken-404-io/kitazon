import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('gcash_payments', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('plan', 20).notNullable();
    t.string('amount', 20).notNullable();
    t.string('reference', 100).notNullable();
    t.text('screenshot_url').nullable();
    t.string('status', 20).notNullable().defaultTo('pending'); // pending | approved | rejected
    t.text('admin_note').nullable();
    t.integer('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('gcash_payments');
}
