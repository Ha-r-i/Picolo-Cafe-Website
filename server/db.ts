import pg from 'pg';
import type { Config } from './config.js';

export type Database = pg.Pool;
type DatabaseConfig = Pick<Config, 'DATABASE_URL' | 'DATABASE_POOL_MAX' | 'DATABASE_SSL'>;

export function makePool(config: DatabaseConfig): Database {
  const useSsl = config.DATABASE_SSL === 'true';

  // A pool reuses connections. Timeouts stop a slow query or lock from
  // keeping a request waiting indefinitely.
  return new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    ssl: useSsl ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    lock_timeout: 4000,
  });
}

export async function assertRuntimeRole(database: Database): Promise<void> {
  const result = await database.query<{ current_user: string }>('select current_user');
  const databaseRole = result.rows[0].current_user;

  if (databaseRole !== 'cafe_api') {
    throw new Error('Runtime database role must be cafe_api.');
  }
}
