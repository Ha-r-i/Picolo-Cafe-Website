import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import type { Config } from './config.js';
import type { Database } from './db.js';
import { safeError } from './errors.js';
import { limiter, bookingRateKeys } from './services.js';
import { tokenVerifier, type VerifyToken } from './modules/auth.js';
import { reservationRoutes } from './modules/reservations.js';
import { menuRoutes } from './modules/menu.js';
import { adminRoutes } from './modules/admin.js';
export async function buildApp(
  config: Config,
  db: Database,
  options: { verify?: VerifyToken; rateLimits?: boolean; logger?: boolean } = {},
) {
  const app = Fastify({
    bodyLimit: 32768,
    requestTimeout: 30000,
    trustProxy: config.TRUST_PROXY ? config.TRUST_PROXY.split(',') : false,
    genReqId: () => randomUUID(),
    logger:
      options.logger === false
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: [
              'req.headers.authorization',
              'req.headers["x-booking-token"]',
              'req.body',
              'res.headers["set-cookie"]',
            ],
            serializers: {
              req: (req: { method: string; url: string; ip: string }) => ({
                method: req.method,
                url: req.url?.split('?')[0],
                remoteAddress: req.ip,
              }),
            },
          },
  });
  const s = {
    db,
    config,
    verify: options.verify ?? tokenVerifier(config),
    limit: options.rateLimits === false ? async () => {} : limiter(db, config),
    bookingRateKeys: options.rateLimits === false ? () => null : bookingRateKeys(config),
  };
  await app.register(cors, {
    origin: config.WEB_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Booking-Token'],
    exposedHeaders: ['X-Request-Id'],
  });
  await app.register(helmet);
  await app.register(multipart, { limits: { files: 1, fileSize: 3145728, fields: 0, parts: 1 } });
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Request-Id', req.id).header('Cache-Control', 'no-store');
    if (!req.url.startsWith('/api/health') && req.method !== 'OPTIONS')
      await s.limit(req, 'general', 120, 60);
  });
  app.setErrorHandler((error, req, reply) => {
    const safe = safeError(error);
    if (safe.status >= 500)
      req.log.error(
        { code: (error as { code?: string }).code, requestId: req.id },
        'Request failed',
      );
    if (safe.status === 429) reply.header('Retry-After', '60');
    reply
      .code(safe.status)
      .send({ error: { code: safe.code, message: safe.message, requestId: req.id } });
  });
  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .send({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: req.id } }),
  );
  app.get('/api/health/live', async () => ({ status: 'ok' }));
  app.get('/api/health/ready', async () => {
    await db.query('select 1');
    return { status: 'ready' };
  });
  reservationRoutes(app, s);
  menuRoutes(app, s);
  adminRoutes(app, s);
  return app;
}
