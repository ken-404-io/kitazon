import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('login_events', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.boolean('success').notNullable();
    t.string('ip_address', 45).nullable();
    t.string('user_agent').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw('CREATE INDEX idx_login_events_user_id ON login_events (user_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('login_events');
}
