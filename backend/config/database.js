const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'kitazon',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kitazon',
  },
  pool: { min: 2, max: 10 },
});

module.exports = db;
