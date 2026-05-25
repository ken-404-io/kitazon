import * as path from 'path';
import db from '../config/database';

// Applies any pending DB migrations on boot. Migrations are authored in
// TypeScript and kept as .ts (so knex's filename-based tracking still matches
// the rows recorded by earlier manual runs). When the app runs as compiled JS
// we register ts-node so knex can require the .ts migration files; in dev,
// ts-node is already active.
export async function runMigrations(): Promise<void> {
  try {
    require('ts-node/register/transpile-only');
  } catch {
    // ts-node unavailable — nothing else we can do; let migrate.latest surface any error.
  }

  const directory = path.resolve(process.cwd(), 'migrations');
  const [batch, applied] = await db.migrate.latest({ directory, loadExtensions: ['.ts'] });

  if (!applied || applied.length === 0) {
    console.log('[migrate] Database already up to date');
  } else {
    console.log(`[migrate] Applied batch ${batch}: ${applied.join(', ')}`);
  }
}
