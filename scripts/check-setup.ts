import { readConfig } from '../server/config.js';
import { assertRuntimeRole, makePool } from '../server/db.js';

async function checkSetup() {
  let config;
  try {
    config = readConfig();
  } catch (error) {
    // Configuration errors list field names only, never their values.
    console.error(error instanceof Error ? error.message : 'Could not read .env.');
    process.exitCode = 1;
    return;
  }

  if (
    process.env.VITE_SUPABASE_URL !== config.SUPABASE_URL ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY !== config.SUPABASE_PUBLISHABLE_KEY
  ) {
    console.error(
      'In .env, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must match their server counterparts. ' +
        'For local development, run npm run setup:local.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('PASS: frontend and API configuration in .env.');
  // npm run dev checks configuration before opening either development server.
  if (process.argv.includes('--config-only')) return;

  const database = makePool(config);
  try {
    await assertRuntimeRole(database);
    const settings = await database.query('select id from cafe_private.settings where id');
    if (settings.rowCount !== 1) throw new Error('Cafe settings are missing.');
    console.log('PASS: PostgreSQL, restricted cafe_api login and application tables.');
  } catch {
    console.error(
      'FAIL: database connection or application tables. Start Docker Desktop, then run ' +
        'npm run supabase:start and npm run setup:local. See docs/beginner-guide.md.',
    );
    process.exitCode = 1;
  } finally {
    await database.end();
  }

  try {
    const response = await fetch(`${config.SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Auth check failed.');
    console.log('PASS: Supabase Auth accepts the configured public key.');
  } catch {
    console.error(
      'FAIL: Supabase Auth connection or public key. Run npm run supabase:start, ' +
        'then npm run setup:local. Changing .env requires restarting npm run dev.',
    );
    process.exitCode = 1;
  }

  if (!process.exitCode) console.log('Setup is ready. Run npm run dev and open http://localhost:3000.');
}

await checkSetup();
