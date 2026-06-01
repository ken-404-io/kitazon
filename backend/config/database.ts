import knex from 'knex';

// pg-level connection options. We build an object form (rather than passing the
// bare connection string) so we can layer on keepAlive + an application_name,
// which makes idle Neon connections survive longer and makes our sessions easy
// to spot in `pg_stat_activity`.
const ssl = { rejectUnauthorized: false };
const connection = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl,
      keepAlive: true,
      application_name: 'kitazon-api',
    }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl,
      keepAlive: true,
      application_name: 'kitazon-api',
    };

const db = knex({
  client: 'pg',
  connection,
  // Neon serverless can scale the compute to zero and recycle idle connections.
  // Keeping min at 0 avoids handing out a stale connection that Neon already
  // closed; idle connections are reaped quickly so the pool stays healthy.
  pool: {
    min: 0,
    // Cap how many connections a single instance opens. Neon's proxy rate-limits
    // *concurrent connection attempts* per endpoint, so when several app
    // instances each try to grow their pool at once during a traffic spike, the
    // attempts collide ("too many database connection attempts are currently
    // ongoing"). A smaller per-instance cap reduces that contention; tune via
    // DB_POOL_MAX. Prefer the Neon pooled (-pooler) endpoint in DATABASE_URL.
    max: Number(process.env.DB_POOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
    reapIntervalMillis: 5_000,
    acquireTimeoutMillis: 30_000,
    // Critical resilience setting. With the default (true), a single failed
    // connection attempt — e.g. Neon throttling a cold-start during a spike —
    // is propagated to *every* queued acquire, so all in-flight requests 500 at
    // once. With false, the pool keeps retrying to create a connection and
    // queued requests wait (up to acquireTimeoutMillis) instead of failing in a
    // synchronized burst.
    propagateCreateError: false,
    // Give a stalled connection attempt time to complete (Neon cold start) and
    // retry creation steadily rather than hammering the proxy.
    createTimeoutMillis: 30_000,
    createRetryIntervalMillis: 500,
  },
  acquireConnectionTimeout: 30_000,
});

export default db;
