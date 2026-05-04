exports.up = (knex) =>
  knex.schema.createTable('referrals', (t) => {
    t.increments('id').primary();
    t.integer('referrer_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('referred_id').notNullable().references('id').inTable('users').onDelete('CASCADE').unique();
    t.decimal('commission_earned', 12, 2).notNullable().defaultTo(0);
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTable('referrals');
