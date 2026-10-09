import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import type { Config } from './config.js';
import type { Database } from './db.js';
import { errorCode, safeError } from './errors.js';
import { limiter, bookingRateKeys, type Services } from './services.js';
import { tokenVerifier, type VerifyToken } from './modules/auth.js';
import { reservationRoutes } from './modules/reservations.js';
import { menuRoutes } from './modules/menu.js';
import { adminRoutes } from './modules/admin.js';

interface AppOptions {
  verify?: VerifyToken;
  rateLimits?: boolean;
  logger?: boolean;
}

// Read this function first: it shows the complete API setup in order.
export async function buildApp(config: Config, database: Database, options: AppOptions = {}) {
  const app = Fastify({
    bodyLimit: 32768,
    requestTimeout: 30000,
    trustProxy: config.TRUST_PROXY ? config.TRUST_PROXY.split(',') : false,
    genReqId: () => randomUUID(),
    logger: options.logger === false ? false : requestLogger(config.LOG_LEVEL),
  });

  const services: Services = {
    db: database,
    config,
    verify: options.verify ?? tokenVerifier(config),
    limit: limiter(database, config),
    bookingRateKeys: bookingRateKeys(config),
  };

  // Only isolated tests disable budgets or inject an identity verifier.
  if (options.rateLimits === false) {
    services.limit = async () => {};
    services.bookingRateKeys = () => null;
  }

  await registerPlugins(app, config.WEB_ORIGIN);
  registerRequestHooks(app, services);
  registerErrorHandlers(app);
  registerHealthRoutes(app, database);

  reservationRoutes(app, services);
  menuRoutes(app, services);
  adminRoutes(app, services);

  return app;
}

function requestLogger(level: string) {
  return {
    level,
    redact: [
      'req.headers.authorization',
      'req.headers["x-booking-token"]',
      'req.body',
      'res.headers["set-cookie"]',
    ],
    serializers: {
      req: (request: { method: string; url: string; ip: string }) => ({
        method: request.method,
        url: request.url?.split('?')[0],
        remoteAddress: request.ip,
      }),
    },
  };
}

async function registerPlugins(app: FastifyInstance, webOrigin: string) {
  await app.register(cors, {
    origin: webOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Booking-Token'],
    exposedHeaders: ['X-Request-Id'],
  });
  await app.register(helmet);
  await app.register(multipart, {
    limits: { files: 1, fileSize: 3145728, fields: 0, parts: 1 },
  });
}

function registerRequestHooks(app: FastifyInstance, services: Services) {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
    reply.header('Cache-Control', 'no-store');

    const isHealthCheck = request.url.startsWith('/api/health');
    const isCorsPreflight = request.method === 'OPTIONS';
    if (!isHealthCheck && !isCorsPreflight) {
      await services.limit(request, 'general', 120, 60);
    }
  });
}

function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const publicError = safeError(error);

    if (publicError.status >= 500) {
      request.log.error({ code: errorCode(error), requestId: request.id }, 'Request failed');
    }
    if (publicError.status === 429) {
      reply.header('Retry-After', '60');
    }

    reply.code(publicError.status).send({
      error: {
        code: publicError.code,
        message: publicError.message,
        requestId: request.id,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: request.id },
    });
  });
}

function registerHealthRoutes(app: FastifyInstance, database: Database) {
  app.get('/api/health/live', async () => ({ status: 'ok' }));

  app.get('/api/health/ready', async () => {
    await database.query('select 1');
    return { status: 'ready' };
  });
}
