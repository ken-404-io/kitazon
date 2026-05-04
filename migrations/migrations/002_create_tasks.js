exports.up = (knex) =>
  knex.schema.createTable('tasks', (t) => {
    t.increments('id').primary();
    t.string('title').notNullable();
    t.text('description');
    t.enu('category', ['survey', 'app_install', 'video', 'microjob', 'game']).notNullable();
    t.decimal('payout', 10, 2).notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTable('tasks');
