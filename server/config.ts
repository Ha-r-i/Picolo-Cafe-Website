import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SECRET_KEY: z.string().min(10),
  GUEST_TOKEN_SECRET: z.string().min(32),
  RATE_LIMIT_SECRET: z.string().min(32),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  PORT: z.coerce.number().int().default(3001),
  HOST: z.string().default('127.0.0.1'),
  TRUST_PROXY: z.string().default(''),
  LOG_LEVEL: z.string().default('info'),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default(''),
  WORKER_POLL_MS: z.coerce.number().int().min(1000).default(5000),
});
export type Config = z.infer<typeof schema>;
export function readConfig(): Config {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Missing/invalid configuration: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}. See .env.example.`,
    );
  if (!/^cafe_api(?:\.[a-z0-9-]+)?$/.test(new URL(result.data.DATABASE_URL).username))
    throw new Error('DATABASE_URL must use restricted cafe_api role. Run npm run db:role.');
  return result.data;
}
