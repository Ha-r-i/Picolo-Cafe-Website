import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import pg from 'pg';

function requireLocalUrl(value: string, name: string) {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(`${name} points outside your computer. Local setup will not change it.`);
  }
  return url;
}

async function setupLocal() {
  // Read existing choices before getting credentials from the local CLI.
  let existing: Record<string, string> = {};
  try {
    existing = parse(await readFile('.env', 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  for (const name of ['DATABASE_URL', 'ADMIN_DATABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL']) {
    if (existing[name]) requireLocalUrl(existing[name], name);
  }

  // Capture CLI output privately: its JSON contains passwords and server keys.
  const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
  let status: Record<string, string>;
  try {
    const output = execFileSync(process.execPath, [cli, 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    });
    status = JSON.parse(output);
  } catch {
    throw new Error('Local Supabase is not ready. Start Docker Desktop, then run npm run supabase:start.');
  }

  const apiUrl = status.API_URL;
  const adminUrl = status.DB_URL;
  const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  const secretKey = status.SECRET_KEY || status.SERVICE_ROLE_KEY;
  if (!apiUrl || !adminUrl || !publicKey || !secretKey) {
    throw new Error('The CLI did not return all local credentials. Run npm run supabase:status.');
  }
  requireLocalUrl(apiUrl, 'Supabase API');
  const databaseUrl = requireLocalUrl(adminUrl, 'Supabase database');

  // Keep the runtime password on repeated setup. Generate it on the first run.
  const previousUrl = existing.DATABASE_URL ? new URL(existing.DATABASE_URL) : null;
  const previousPassword = previousUrl?.username === 'cafe_api'
    ? decodeURIComponent(previousUrl.password)
    : '';
  const password = previousPassword.length >= 24 ? previousPassword : randomBytes(32).toString('hex');
  databaseUrl.username = 'cafe_api';
  databaseUrl.password = password;

  const settings = {
    ...parse(await readFile('.env.example', 'utf8')),
    ...existing,
    VITE_SUPABASE_URL: apiUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
    VITE_API_URL: '/api',
    SUPABASE_URL: apiUrl,
    SUPABASE_PUBLISHABLE_KEY: publicKey,
    SUPABASE_SECRET_KEY: secretKey,
    ADMIN_DATABASE_URL: adminUrl,
    DATABASE_URL: databaseUrl.toString(),
    DATABASE_SSL: 'false',
    WEB_ORIGIN: 'http://localhost:3000',
    GUEST_TOKEN_SECRET: existing.GUEST_TOKEN_SECRET?.length >= 32
      ? existing.GUEST_TOKEN_SECRET : randomBytes(32).toString('hex'),
    RATE_LIMIT_SECRET: existing.RATE_LIMIT_SECRET?.length >= 32
      ? existing.RATE_LIMIT_SECRET : randomBytes(32).toString('hex'),
    TEST_SUPABASE_URL: apiUrl,
    TEST_SUPABASE_PUBLISHABLE_KEY: publicKey,
    TEST_SUPABASE_SECRET_KEY: secretKey,
  };

  const backup = `.local-backup/setup-${new Date().toISOString().replaceAll(':', '-')}`;
  await mkdir(backup, { recursive: true });
  try {
    await copyFile('.env', `${backup}/.env`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  // JSON quoting preserves spaces, # characters and embedded newlines for dotenv.
  const contents = Object.entries(settings).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n');
  await writeFile('.env', `# Local development settings. Keep this file private.\n${contents}\n`, 'utf8');

  const operator = new pg.Pool({ connectionString: adminUrl, connectionTimeoutMillis: 5000 });
  try {
    // Role name is fixed. ALTER ROLE requires an escaped SQL literal here.
    await operator.query(`alter role cafe_api login password '${password.replace(/'/g, "''")}'`);
  } catch {
    throw new Error('Could not provision cafe_api. Check npm run supabase:start finished applying migrations, then retry setup.');
  } finally {
    await operator.end();
  }

  console.log(`Local .env saved; its previous contents are backed up in ${backup}.`);
  console.log('Restricted cafe_api login configured. No keys or passwords were printed.');
  console.log('Next: npm run doctor, then npm run dev. Restart an existing dev terminal after changing .env.');
}

try {
  await setupLocal();
} catch (error) {
  // Only our own messages are safe to display. Filesystem/URL errors get a fixed explanation.
  const message = error instanceof Error ? error.message : '';
  const safe = /^(Local Supabase|The CLI|Could not provision|[A-Z_]+ points|Supabase (API|database) points)/.test(message);
  console.error(safe ? message : 'Local setup failed. Check the .env format and follow docs/beginner-guide.md.');
  process.exitCode = 1;
}
