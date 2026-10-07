import { readConfig } from './config.js';
import { makePool } from './db.js';
import { buildApp } from './app.js';
const config = readConfig();
const db = makePool(config);
const role = (await db.query('select current_user')).rows[0].current_user;
if (role !== 'cafe_api') throw new Error('Runtime database role must be cafe_api.');
const app = await buildApp(config, db);
db.on('error', (err) =>
  app.log.error({ code: (err as { code?: string }).code }, 'Idle database connection failed'),
);
await app.listen({ port: config.PORT, host: config.HOST });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => db.end());
  });
