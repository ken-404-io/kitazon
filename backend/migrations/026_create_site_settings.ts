import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('site_settings', (t) => {
    t.string('key').primary();
    t.text('value').notNullable().defaultTo('');
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  const defaults: Array<{ key: string; value: string }> = [
    { key: 'gcash_number',          value: '' },
    { key: 'gcash_name',            value: 'Kitazon' },
    { key: 'gcash_qr_silver',       value: 'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935459/4432f02f-79d9-4bf7-bd8f-39f0b63487ad_qbjxzx.jpg' },
    { key: 'gcash_qr_gold',         value: 'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935610/1593c9bc-c490-4854-826d-72ad2a5a79a1_cwdk3l.jpg' },
    { key: 'gcash_qr_diamond',      value: 'https://res.cloudinary.com/dtm4n2uk3/image/upload/v1778935570/69504c45-6f87-43b1-aebe-83d55a30e5be_p6tncl.jpg' },
    { key: 'credit_php_per_credit', value: '10' },
    { key: 'withdrawal_min',        value: '5' },
    { key: 'announcement_text',     value: '' },
    { key: 'announcement_color',    value: '#f59e0b' },
    { key: 'maintenance_mode',      value: 'false' },
    { key: 'quiz_gate_free',        value: '40' },
    { key: 'quiz_gate_silver',      value: '20' },
    { key: 'quiz_gate_gold',        value: '0' },
    { key: 'quiz_gate_diamond',     value: '0' },
    { key: 'referral_gate_free',    value: '2' },
    { key: 'referral_gate_silver',  value: '1' },
    { key: 'referral_gate_gold',    value: '0' },
    { key: 'referral_gate_diamond', value: '0' },
    { key: 'plan_price_silver',     value: '499' },
    { key: 'plan_price_gold',       value: '1299' },
    { key: 'plan_price_diamond',    value: '1999' },
    { key: 'plan_limit_free',       value: '5' },
    { key: 'plan_limit_silver',     value: '20' },
    { key: 'plan_limit_gold',       value: '50' },
    { key: 'plan_limit_diamond',    value: '100' },
  ];

  await knex('site_settings').insert(defaults);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('site_settings');
}
