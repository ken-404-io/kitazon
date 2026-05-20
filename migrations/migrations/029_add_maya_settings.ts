import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const rows = [
    { key: 'maya_number',       value: '' },
    { key: 'maya_name',         value: 'Kitazon' },
    { key: 'maya_qr_bronze',    value: '' },
    { key: 'maya_qr_silver',    value: '' },
    { key: 'maya_qr_gold',      value: '' },
    { key: 'maya_qr_diamond',   value: '' },
  ];
  for (const row of rows) {
    const exists = await knex('site_settings').where({ key: row.key }).first();
    if (!exists) await knex('site_settings').insert(row);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('site_settings').whereIn('key', [
    'maya_number', 'maya_name',
    'maya_qr_bronze', 'maya_qr_silver', 'maya_qr_gold', 'maya_qr_diamond',
  ]).delete();
}
