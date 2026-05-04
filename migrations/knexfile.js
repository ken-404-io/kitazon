require('dotenv').config({ path: '../backend/.env' });

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'kitazon',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kitazon',
    },
    migrations: { directory: './migrations' },
    seeds: { directory: './seeds' },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    migrations: { directory: './migrations' },
  },
};
