import pg from 'pg';

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/loyalink_test';
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await c.end();
}
