import { adminPool, apply } from './admin-db.js';
import { runMigrations } from './migrations.js';
const db = adminPool();
try {
  await runMigrations(db, apply());
} finally {
  await db.end();
}
