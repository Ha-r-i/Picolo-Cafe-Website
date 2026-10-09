import pg from 'pg';
import { startNative } from './native-db.js';
import { runMigrations } from './migrations.js';
import { buildApp } from '../server/app.js';
import type { Config } from '../server/config.js';
export async function localFixture() {
  const native = await startNative();
  const owner = new pg.Pool({ connectionString: native.url });
  await runMigrations(owner, true);
  await owner.query("alter role cafe_api login password 'local-runtime-test-password'");
  const url = new URL(native.url);
  url.username = 'cafe_api';
  url.password = 'local-runtime-test-password';
  const config: Config = {
    DATABASE_URL: url.toString(),
    DATABASE_SSL: 'false',
    DATABASE_POOL_MAX: 10,
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_PUBLISHABLE_KEY: 'local-fixture-public-key',
    SUPABASE_SECRET_KEY: 'local-fixture-secret-key',
    GUEST_TOKEN_SECRET: 'fixture-guest-secret-longer-than-32-characters',
    RATE_LIMIT_SECRET: 'fixture-limit-secret-longer-than-32-characters',
    WEB_ORIGIN: 'http://localhost:3000',
    PORT: 3001,
    HOST: '127.0.0.1',
    TRUST_PROXY: '',
    LOG_LEVEL: 'silent',
    RESEND_API_KEY: '',
    EMAIL_FROM: '',
    WORKER_POLL_MS: 1000,
  };
  return {
    owner,
    native,
    config,
    async api(rateLimits = true) {
      const pool = new pg.Pool({ connectionString: url.toString(), max: 10 });
      const app = await buildApp(config, pool, { logger: false, rateLimits });
      return { app, pool };
    },
  };
}
