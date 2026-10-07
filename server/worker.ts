import { setTimeout } from 'node:timers/promises';
import { readConfig } from './config.js';
import { makePool } from './db.js';
import { processOne, resendSender } from './modules/notifications.js';
const config = readConfig();
if (!config.RESEND_API_KEY || !config.EMAIL_FROM)
  throw new Error(
    'Worker needs RESEND_API_KEY and verified EMAIL_FROM. Queued events remain durable until configured.',
  );
const db = makePool({ ...config, DATABASE_POOL_MAX: 2 });
let running = true;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    running = false;
  });
const send = resendSender(config.RESEND_API_KEY, config.EMAIL_FROM);
while (running) {
  try {
    const outcome = await processOne(db, send);
    if (outcome !== 'idle')
      process.stdout.write(
        JSON.stringify({
          level: 'info',
          event: 'notification',
          outcome,
          time: new Date().toISOString(),
        }) + '\n',
      );
    if (outcome === 'idle') {
      await db.query(
        "delete from cafe_private.request_limits where window_start<now()-interval '2 days'",
      );
      await setTimeout(config.WORKER_POLL_MS);
    }
  } catch {
    process.stderr.write(JSON.stringify({ level: 'error', event: 'worker_database_error' }) + '\n');
    await setTimeout(config.WORKER_POLL_MS);
  }
}
await db.end();
