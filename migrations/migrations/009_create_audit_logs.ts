import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('action', 100).notNullable();
    t.decimal('amount', 12, 2).nullable();
    t.string('ip_address', 45).nullable();
    t.string('user_agent').nullable();
    t.jsonb('metadata').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw('CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('audit_logs');
}
