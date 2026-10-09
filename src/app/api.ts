import { createClient } from '@supabase/supabase-js';
export const authConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const supabase = authConfigured
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? AbortSignal.timeout(25000),
    });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'We could not reach the cafe. Check your connection and try again.',
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? 'The request failed. Please retry.',
      body?.error?.requestId,
    );
  return body as T;
}
export function imageUrl(path: string) {
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`;
}
