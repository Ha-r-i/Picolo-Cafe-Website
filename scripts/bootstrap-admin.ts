import { adminPool, apply, option } from './admin-db.js';
import { z } from 'zod';
const id = z.uuid().parse(option('--user-id'));
const db = adminPool();
const client = await db.connect();
try {
  await client.query('begin');
  await client.query('select pg_advisory_xact_lock(614021)');
  if (
    (await client.query("select count(*)::integer n from public.profiles where role='admin'"))
      .rows[0].n > 0
  )
    throw new Error('An administrator already exists. Use the authorized role-management API.');
  const user = (
    await client.query('select id,email,email_confirmed_at from auth.users where id=$1', [id])
  ).rows[0];
  if (!user?.email_confirmed_at)
    throw new Error('The target must be an existing user with a confirmed email address.');
  await client.query("update public.profiles set role='admin' where id=$1", [id]);
  await client.query(apply() ? 'commit' : 'rollback');
  process.stdout.write(
    apply()
      ? 'Administrator bootstrapped.\n'
      : 'Bootstrap validated; no changes made. Use --apply to write.\n',
  );
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await db.end();
}
