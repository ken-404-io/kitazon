import type { Knex } from 'knex';

const KEYS = ['promo_popup_enabled', 'promo_popup_image', 'promo_popup_redirect'];

export async function up(knex: Knex): Promise<void> {
  const rows = [
    { key: 'promo_popup_enabled',  value: 'true' },
    { key: 'promo_popup_image',    value: '' },
    { key: 'promo_popup_redirect', value: '/plans' },
  ];
  for (const row of rows) {
    const exists = await knex('site_settings').where({ key: row.key }).first();
    if (!exists) await knex('site_settings').insert(row);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('site_settings').whereIn('key', KEYS).delete();
}
