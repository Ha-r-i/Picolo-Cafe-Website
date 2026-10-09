import 'dotenv/config';
import { z } from 'zod';

// Zod checks the environment once at startup and converts number strings.
const configurationSchema = z.object({
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

export type Config = z.infer<typeof configurationSchema>;

export function readConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configurationSchema.safeParse(environment);

  if (!parsed.success) {
    // Report field names only; environment values can contain passwords.
    const invalidFields = parsed.error.issues.map((issue) => issue.path.join('.'));
    throw new Error(
      `Missing/invalid configuration: ${invalidFields.join(', ')}. ` +
        'Put your settings in the root .env file, not .env.example. ' +
        'For local development, follow docs/beginner-guide.md and run npm run setup:local.',
    );
  }

  const config = parsed.data;
  const databaseUsername = new URL(config.DATABASE_URL).username;
  // Supabase pooler usernames can have the form cafe_api.PROJECT_ID.
  const usesRuntimeRole = /^cafe_api(?:\.[a-z0-9-]+)?$/.test(databaseUsername);

  if (!usesRuntimeRole) {
    throw new Error(
      'DATABASE_URL must use restricted cafe_api role. ' +
        'For local development, run npm run setup:local; manual operator setup uses npm run db:role.',
    );
  }

  return config;
}
