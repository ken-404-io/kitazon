import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', (t) => {
    t.increments('id');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('type', 50).notNullable().defaultTo('broadcast');
    t.string('title', 200).notNullable();
    t.text('message').notNullable();
    t.timestamp('read_at').nullable().defaultTo(null);
    t.timestamps(true, true);
  });
  await knex.schema.raw('CREATE INDEX notifications_user_unread ON notifications (user_id, read_at)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}
