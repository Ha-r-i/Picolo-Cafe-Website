import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { assertRuntimeRole, makePool } from './db.js';
import { errorCode } from './errors.js';

// Startup is intentionally separate from app.ts so tests can build an API
// without opening an HTTP port or reading real environment variables.
async function startServer() {
  const config = readConfig();
  const database = makePool(config);

  await assertRuntimeRole(database);
  const app = await buildApp(config, database);

  database.on('error', (error) => {
    app.log.error({ code: errorCode(error) }, 'Idle database connection failed');
  });

  await app.listen({ port: config.PORT, host: config.HOST });

  async function shutdown() {
    // Stop accepting requests before closing their database connections.
    await app.close();
    await database.end();
  }

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

await startServer();
