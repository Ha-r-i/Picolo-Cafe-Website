import pg from 'pg';
import type { Config } from './config.js';
export function makePool(
  config: Pick<Config, 'DATABASE_URL' | 'DATABASE_POOL_MAX' | 'DATABASE_SSL'>,
) {
  return new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    ssl: config.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    lock_timeout: 4000,
  });
}
export type Database = pg.Pool;
