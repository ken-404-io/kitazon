import type { Knex } from 'knex';

// Payment-method management:
//  - users.gcash_number / gcash_name: the admin-set authoritative withdrawal
//    account. When set, the user's withdrawals are locked to this number and the
//    saved-account UI shows it. Users can only change it via a review request.
//  - payment_change_requests: a user's request to change their GCash account,
//    with a reason and a proof screenshot, reviewed by an admin.
export async function up(knex: Knex): Promise<void> {
  const hasNumber = await knex.schema.hasColumn('users', 'gcash_number');
  const hasName = await knex.schema.hasColumn('users', 'gcash_name');
  await knex.schema.alterTable('users', (t) => {
    if (!hasNumber) t.string('gcash_number', 20).nullable();
    if (!hasName) t.string('gcash_name', 100).nullable();
  });

  const hasTable = await knex.schema.hasTable('payment_change_requests');
  if (!hasTable) {
    await knex.schema.createTable('payment_change_requests', (t) => {
      t.increments('id');
      t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('current_number', 20).nullable();
      t.string('requested_number', 20).notNullable();
      t.string('requested_name', 100).notNullable();
      t.text('reason').notNullable();
      t.text('screenshot_url').nullable();
      t.string('status', 20).notNullable().defaultTo('pending'); // pending | approved | rejected
      t.text('admin_note').nullable();
      t.integer('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamps(true, true);
    });
    await knex.schema.raw('CREATE INDEX pcr_status_idx ON payment_change_requests (status, created_at)');
    await knex.schema.raw('CREATE INDEX pcr_user_idx ON payment_change_requests (user_id, created_at)');
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payment_change_requests');
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('gcash_number');
    t.dropColumn('gcash_name');
  });
}
