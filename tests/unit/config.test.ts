import { describe, expect, it } from 'vitest';
import { readConfig } from '../../server/config';

const validEnvironment = {
  DATABASE_URL: 'postgresql://cafe_api:unit-test-password@127.0.0.1:54322/postgres',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'unit-test-public-key',
  SUPABASE_SECRET_KEY: 'unit-test-server-secret',
  GUEST_TOKEN_SECRET: 'unit-test-guest-secret-at-least-32-characters',
  RATE_LIMIT_SECRET: 'unit-test-rate-secret-at-least-32-characters',
};

describe('startup configuration', () => {
  it('explains which file and setup command to use when settings are missing', () => {
    expect(() => readConfig({})).toThrow(/root \.env file, not \.env\.example/);
    expect(() => readConfig({})).toThrow(/npm run setup:local/);
  });

  it('reports invalid field names without printing secret values', () => {
    const secret = 'private-short-secret';
    try {
      readConfig({ ...validEnvironment, GUEST_TOKEN_SECRET: secret });
      expect.fail('An invalid secret must prevent startup.');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('GUEST_TOKEN_SECRET');
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('accepts restricted runtime connections and refuses the owner connection', () => {
    expect(readConfig(validEnvironment).DATABASE_POOL_MAX).toBe(5);
    expect(() => readConfig({
      ...validEnvironment,
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    })).toThrow(/restricted cafe_api/);
  });
});
