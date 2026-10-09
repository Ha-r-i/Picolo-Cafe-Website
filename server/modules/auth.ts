import type { FastifyRequest } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../db.js';
import type { Config } from '../config.js';
import type { Role } from '../../shared/types.js';
import { AppError } from '../errors.js';

export interface Actor {
  id: string;
  role: Role;
}

export type VerifyToken = (token: string) => Promise<string | null>;

export function tokenVerifier(config: Config): VerifyToken {
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
    },
  });

  return async (token) => {
    const response = await client.auth.getUser(token);
    // Contact Supabase Auth; decoding a JWT alone does not verify a session.
    if (response.error) {
      return null;
    }
    return response.data.user?.id ?? null;
  };
}

// Guest-friendly routes can continue when this returns null.
export async function actorFor(
  request: FastifyRequest,
  database: Database,
  verify: VerifyToken,
): Promise<Actor | null> {
  const header = request.headers.authorization;
  if (!header) {
    return null;
  }
  if (!header.startsWith('Bearer ') || header.length > 8192) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid session.');
  }

  const userId = await verify(header.slice(7));
  if (!userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Please sign in again.');
  }

  // A role comes from our database, never customer-editable Auth metadata.
  const result = await database.query<{ role: Role }>(
    'select role from public.profiles where id = $1',
    [userId],
  );
  const profile = result.rows[0];
  if (!profile) {
    throw new AppError(401, 'UNAUTHORIZED', 'Account not available.');
  }

  return { id: userId, role: profile.role };
}

export async function requiredActorFor(
  request: FastifyRequest,
  database: Database,
  verify: VerifyToken,
): Promise<Actor> {
  const actor = await actorFor(request, database, verify);
  if (!actor) {
    throw new AppError(401, 'UNAUTHORIZED', 'Please sign in.');
  }
  return actor;
}

export async function staffFor(
  request: FastifyRequest,
  database: Database,
  verify: VerifyToken,
  adminOnly = false,
): Promise<Actor> {
  const actor = await requiredActorFor(request, database, verify);
  const isStaff = actor.role === 'staff' || actor.role === 'admin';
  const hasRequiredRole = adminOnly ? actor.role === 'admin' : isStaff;

  if (!hasRequiredRole) {
    throw new AppError(403, 'FORBIDDEN', 'Staff access required.');
  }
  return actor;
}
