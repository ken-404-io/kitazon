exports.up = (knex) =>
  knex.schema.createTable('earnings', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('task_id').nullable().references('id').inTable('tasks').onDelete('SET NULL');
    t.decimal('amount', 10, 2).notNullable();
    t.enu('type', ['task', 'referral_signup', 'referral_commission', 'spin']).notNullable();
    t.string('description');
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTable('earnings');
