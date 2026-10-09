import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
async function command(binary: string, args: string[]) {
  return new Promise<void>((done, reject) => {
    let output = '';
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => {
      output += String(d);
    });
    child.stderr.on('data', (d) => {
      output += String(d);
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? done() : reject(new Error(`PostgreSQL command failed (${code}): ${output}`)),
    );
  });
}
async function freePort() {
  const server = createServer();
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}
export async function startNative() {
  const directory = resolve('.local-db', `test-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const port = await freePort();
  const binaries = (await import(
    `@embedded-postgres/${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`
  )) as { pg_ctl: string };
  const postgres = new EmbeddedPostgres({
    databaseDir: directory,
    port,
    user: 'postgres',
    password: 'local-test-password',
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
  await postgres.initialise();
  try {
    await command(binaries.pg_ctl, [
      '-D',
      directory,
      '-l',
      resolve(directory, 'server.log'),
      '-o',
      `-h 127.0.0.1 -p ${port}`,
      '-w',
      'start',
    ]);
  } catch (e) {
    process.stderr.write(await readFile(resolve(directory, 'server.log'), 'utf8').catch(() => ''));
    throw e;
  }
  const base = `postgresql://postgres:local-test-password@127.0.0.1:${port}`;
  const db = new pg.Pool({ connectionString: `${base}/postgres` });
  await db.query('create database piccolo_test');
  await db.end();
  const url = `${base}/piccolo_test`;
  const fixture = new pg.Pool({ connectionString: url });
  await fixture.query(await readFile('tests/fixtures/supabase-bootstrap.sql', 'utf8'));
  await fixture.end();
  return {
    url,
    stop: () => command(binaries.pg_ctl, ['-D', directory, '-m', 'fast', '-w', 'stop']),
  };
}
