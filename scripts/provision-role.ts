import { adminPool, apply } from './admin-db.js';
const db = adminPool();
const password = process.env.CAFE_API_PASSWORD;
if (!password || password.length < 24)
  throw new Error('Set CAFE_API_PASSWORD to a random password of at least 24 characters.');
try {
  // PostgreSQL ALTER ROLE cannot parameterize its password. Escape SQL literal,
  // keep it out of logs and never accept a role name from user input.
  if (apply())
    await db.query(`alter role cafe_api login password '${password.replace(/'/g, "''")}'`);
  process.stdout.write(
    apply()
      ? 'cafe_api login provisioned. Update DATABASE_URL.\n'
      : 'Validated. Run with --apply to provision cafe_api login.\n',
  );
} finally {
  await db.end();
}
