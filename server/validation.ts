import { z } from 'zod';

export const uuid = z.uuid();

export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParams = z.object({ id: uuid });

// SQL parameters prevent injection. Escaping these characters also makes
// a customer's search text literal instead of treating it as a wildcard.
export function searchPattern(search: string): string {
  if (!search) {
    return '';
  }

  const escaped = search.replace(/[%_\\]/g, '\\$&');
  return `%${escaped}%`;
}
