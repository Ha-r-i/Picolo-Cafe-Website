import { readFile } from 'node:fs/promises';
import { adminPool, apply } from './admin-db.js';
const db = adminPool();
const client = await db.connect();
try {
  await client.query('begin');
  await client.query(await readFile('supabase/seed.sql', 'utf8'));
  await client.query(apply() ? 'commit' : 'rollback');
  process.stdout.write(
    apply()
      ? 'Development sample data applied.\n'
      : 'Seed validated; transaction rolled back. Use --apply to write.\n',
  );
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await db.end();
}
