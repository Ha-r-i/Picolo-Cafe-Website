import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type pg from 'pg';
export async function runMigrations(db: pg.Pool, apply: boolean, includeStorage = true) {
  const files = (await readdir('supabase/migrations'))
    .filter((f) => f.endsWith('.sql') && (includeStorage || !f.includes('storage')))
    .sort();
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(614020)');
    await client.query('create schema if not exists cafe_private');
    await client.query(
      'create table if not exists cafe_private.schema_migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now())',
    );
    for (const file of files) {
      const sql = await readFile(`supabase/migrations/${file}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = (
        await client.query('select checksum from cafe_private.schema_migrations where name=$1', [
          file,
        ])
      ).rows[0];
      if (existing) {
        if (existing.checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query(
        'insert into cafe_private.schema_migrations(name,checksum) values($1,$2)',
        [file, checksum],
      );
      process.stdout.write(`${apply ? 'Apply' : 'Validate in rolled-back transaction'}: ${file}\n`);
    }
    await client.query(apply ? 'commit' : 'rollback');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
