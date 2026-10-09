import { createHmac } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Database } from './db.js';
import type { Config } from './config.js';
import type { VerifyToken } from './modules/auth.js';
import { AppError } from './errors.js';

interface BookingRateKeys {
  ip: string;
  email: string;
}

type CheckRateLimit = (
  request: FastifyRequest,
  bucket: string,
  maxRequests: number,
  windowSeconds: number,
  shared?: boolean,
) => Promise<void>;

// Routes receive the same dependencies. Tests can supply their own verifier.
export interface Services {
  db: Database;
  config: Config;
  verify: VerifyToken;
  bookingRateKeys: (request: FastifyRequest, email: string) => BookingRateKeys | null;
  limit: CheckRateLimit;
}

function hashRateKey(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function bookingRateKeys(config: Config): Services['bookingRateKeys'] {
  return (request, email) => {
    // Keep these exact prefixes stable across releases and API instances.
    return {
      ip: hashRateKey(config.RATE_LIMIT_SECRET, `${request.ip}:booking`),
      email: hashRateKey(config.RATE_LIMIT_SECRET, `:email:${email}`),
    };
  };
}

export function limiter(database: Database, config: Config): CheckRateLimit {
  return async (request, bucket, maxRequests, windowSeconds, shared = false) => {
    const ipAddress = shared ? '' : request.ip;
    const key = hashRateKey(config.RATE_LIMIT_SECRET, `${ipAddress}:${bucket}`);

    // Store limits in PostgreSQL so multiple API instances share the budget.
    const result = await database.query<{ allowed: boolean }>(
      'select cafe_private.consume_limit($1, $2, $3) as allowed',
      [key, maxRequests, windowSeconds],
    );

    if (!result.rows[0].allowed) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
    }
  };
}
