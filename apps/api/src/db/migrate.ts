import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { db, pool } from './index.js';

export function migrationsFolder() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/db → ../../drizzle ; dist → ../drizzle
  for (const p of [path.resolve(here, '../../drizzle'), path.resolve(here, '../drizzle'), path.resolve(process.cwd(), 'drizzle')]) {
    if (fs.existsSync(path.join(p, 'meta'))) return p;
  }
  throw new Error('drizzle migrations folder not found');
}

export async function runMigrations() {
  await db.execute('create extension if not exists pgcrypto');
  await migrate(db, { migrationsFolder: migrationsFolder() });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('migrations applied');
      return pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
