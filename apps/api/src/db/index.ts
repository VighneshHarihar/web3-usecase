import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
export type Executor = DB | Tx;

// bigint (int8) → number. All our int8 values (paise, seq) are well inside 2^53.
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
export const db: DB = drizzle(pool, { schema });
export { schema };
