import knex from 'knex';

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL ?? {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  },
  // Neon serverless can scale the compute to zero and recycle idle connections.
  // Keeping min at 0 avoids handing out a stale connection that Neon already
  // closed; idle connections are reaped quickly so the pool stays healthy.
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30_000,
    reapIntervalMillis: 5_000,
    acquireTimeoutMillis: 30_000,
  },
  acquireConnectionTimeout: 30_000,
});

export default db;
