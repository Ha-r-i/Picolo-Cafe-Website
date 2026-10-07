import { createHmac } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Database } from './db.js';
import type { Config } from './config.js';
import type { VerifyToken } from './modules/auth.js';
import { AppError } from './errors.js';
export interface Services {
  db: Database;
  config: Config;
  verify: VerifyToken;
  bookingRateKeys: (req: FastifyRequest, email: string) => { ip: string; email: string } | null;
  limit: (
    req: FastifyRequest,
    bucket: string,
    max: number,
    seconds: number,
    shared?: boolean,
  ) => Promise<void>;
}
export function bookingRateKeys(config: Config): Services['bookingRateKeys'] {
  return (req, email) => {
    const hash = (value: string) =>
      createHmac('sha256', config.RATE_LIMIT_SECRET).update(value).digest('hex');
    return { ip: hash(`${req.ip}:booking`), email: hash(`:email:${email}`) };
  };
}
export function limiter(db: Database, config: Config): Services['limit'] {
  return async (req, bucket, max, seconds, shared = false) => {
    const key = createHmac('sha256', config.RATE_LIMIT_SECRET)
      .update(`${shared ? '' : req.ip}:${bucket}`)
      .digest('hex');
    const { rows } = await db.query('select cafe_private.consume_limit($1,$2,$3) allowed', [
      key,
      max,
      seconds,
    ]);
    if (!rows[0].allowed)
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
  };
}
