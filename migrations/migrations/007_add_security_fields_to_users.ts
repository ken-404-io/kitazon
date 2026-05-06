import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.boolean('email_verified').notNullable().defaultTo(false);
    t.string('email_verification_token').nullable();
    t.timestamp('email_verification_expires').nullable();
    t.timestamp('last_login_at').nullable();
    t.string('last_login_ip', 45).nullable();
    t.string('last_withdrawal_account').nullable();
    t.timestamp('last_withdrawal_account_changed_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('email_verified');
    t.dropColumn('email_verification_token');
    t.dropColumn('email_verification_expires');
    t.dropColumn('last_login_at');
    t.dropColumn('last_login_ip');
    t.dropColumn('last_withdrawal_account');
    t.dropColumn('last_withdrawal_account_changed_at');
  });
}
