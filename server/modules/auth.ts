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
    const { data, error } = await client.auth.getUser(token);
    // getUser contacts Supabase Auth; never trust decoded JWT or browser getSession.
    return error ? null : (data.user?.id ?? null);
  };
}
export async function actorFor(
  request: FastifyRequest,
  db: Database,
  verify: VerifyToken,
  required = false,
): Promise<Actor | null> {
  const header = request.headers.authorization;
  if (!header) {
    if (required) throw new AppError(401, 'UNAUTHORIZED', 'Please sign in.');
    return null;
  }
  if (!header.startsWith('Bearer ') || header.length > 8192)
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid session.');
  const id = await verify(header.slice(7));
  if (!id) throw new AppError(401, 'UNAUTHORIZED', 'Please sign in again.');
  const { rows } = await db.query<{ role: Role }>('select role from public.profiles where id=$1', [
    id,
  ]);
  if (!rows[0]) throw new AppError(401, 'UNAUTHORIZED', 'Account not available.');
  return { id, role: rows[0].role };
}
export async function staffFor(
  request: FastifyRequest,
  db: Database,
  verify: VerifyToken,
  admin = false,
) {
  const actor = await actorFor(request, db, verify, true);
  if (!actor || !(admin ? actor.role === 'admin' : ['staff', 'admin'].includes(actor.role)))
    throw new AppError(403, 'FORBIDDEN', 'Staff access required.');
  return actor;
}
