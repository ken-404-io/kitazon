import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // KYC status on users table
  await knex.raw(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;

    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_kyc_status_check;

    ALTER TABLE users
      ADD CONSTRAINT users_kyc_status_check
        CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected'));
  `);

  // KYC submissions table
  await knex.schema.createTableIfNotExists('kyc_submissions', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('full_name').notNullable();
    t.date('date_of_birth').notNullable();
    t.text('nationality').notNullable();
    t.text('id_type').notNullable();
    t.text('id_number').notNullable();
    t.text('address').notNullable();
    t.text('city').notNullable();
    t.text('province').notNullable();
    t.text('status').notNullable().defaultTo('pending');
    t.integer('reviewed_by').references('id').inTable('users').nullable();
    t.text('rejection_reason').nullable();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('kyc_submissions');
  await knex.raw(`
    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_kyc_status_check,
      DROP COLUMN IF EXISTS kyc_status,
      DROP COLUMN IF EXISTS kyc_submitted_at,
      DROP COLUMN IF EXISTS kyc_reviewed_at,
      DROP COLUMN IF EXISTS kyc_rejection_reason;
  `);
}
