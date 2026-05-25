import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE kyc_submissions
      ADD COLUMN IF NOT EXISTS id_front_data TEXT,
      ADD COLUMN IF NOT EXISTS id_back_data TEXT,
      ADD COLUMN IF NOT EXISTS selfie_data TEXT,
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE kyc_submissions
      DROP COLUMN IF EXISTS id_front_data,
      DROP COLUMN IF EXISTS id_back_data,
      DROP COLUMN IF EXISTS selfie_data,
      DROP COLUMN IF EXISTS tags;
  `);
}
