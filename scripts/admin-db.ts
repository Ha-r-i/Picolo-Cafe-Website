import 'dotenv/config';
import pg from 'pg';
export function adminPool(url = process.env.ADMIN_DATABASE_URL) {
  if (!url)
    throw new Error(
      'ADMIN_DATABASE_URL is missing from .env. This command needs the operator database connection. ' +
        'For local development, start Supabase and run npm run setup:local first.',
    );
  return new pg.Pool({
    connectionString: url,
    max: 2,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
}
export function option(name: string) {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}
export const apply = () => process.argv.includes('--apply');
