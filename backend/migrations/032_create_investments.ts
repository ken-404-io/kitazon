import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.decimal('kitagrow_balance', 12, 2).notNullable().defaultTo(0);
  });

  await knex.schema.createTable('investments', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('term_days').notNullable();            // 30 | 60 | 120
    t.decimal('amount', 12, 2).notNullable();        // principal
    t.decimal('payout_amount', 12, 2).notNullable(); // principal * multiplier
    t.string('reference', 100).notNullable();        // GCash reference #
    t.text('screenshot_url').nullable();
    t.string('status', 20).notNullable().defaultTo('pending'); // pending | active | matured | rejected
    t.text('admin_note').nullable();
    t.integer('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('activated_at', { useTz: true }).nullable();
    t.timestamp('matures_at', { useTz: true }).nullable();
    t.timestamp('paid_out_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'status']);
    t.index(['status', 'matures_at']);
  });

  await knex.schema.createTable('kitagrow_withdrawals', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.decimal('amount', 12, 2).notNullable();
    t.string('channel', 20).notNullable().defaultTo('gcash');
    t.string('account_number', 30).notNullable();
    t.string('account_name', 100).notNullable();
    t.string('status', 20).notNullable().defaultTo('pending'); // pending | processing | completed | rejected
    t.text('admin_note').nullable();
    t.integer('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('kitagrow_withdrawals');
  await knex.schema.dropTableIfExists('investments');
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('kitagrow_balance');
  });
}
