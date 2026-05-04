import type { Knex } from 'knex';
import 'dotenv/config';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'kitazon',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'kitazon',
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

export default config;
