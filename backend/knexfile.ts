import 'dotenv/config';
import * as path from 'path';
import type { Knex } from 'knex';

const connection: Knex.PgConnectionConfig | string =
  process.env.DATABASE_URL ?? {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  };

const base: Knex.Config = {
  client: 'pg',
  connection,
  migrations: { directory: path.join(__dirname, 'migrations') },
};

const config: { [key: string]: Knex.Config } = {
  development: base,
  production: base,
};

export default config;
