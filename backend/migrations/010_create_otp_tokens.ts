import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('otp_tokens', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token_hash').notNullable();
    t.enu('purpose', ['email_verify', 'withdrawal_otp', 'password_reset']).notNullable();
    t.timestamp('expires_at').notNullable();
    t.timestamp('used_at').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('otp_tokens');
}
