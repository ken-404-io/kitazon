exports.up = (knex) =>
  knex.schema.createTable('withdrawals', (t) => {
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

exports.down = (knex) => knex.schema.dropTable('withdrawals');
