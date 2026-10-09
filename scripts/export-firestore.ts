import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { option } from './admin-db.js';
// Operator-owned, read-only export. No Firebase SDK remains in application runtime.
const project = option('--project');
const token = process.env.GOOGLE_ACCESS_TOKEN;
if (!project || !token || !/^[a-z0-9-]+$/.test(project))
  throw new Error(
    'Pass --project PROJECT_ID and set a short-lived GOOGLE_ACCESS_TOKEN with Firestore read access.',
  );
type Field = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields: Record<string, Field> };
  arrayValue?: { values: Field[] };
};
function decode(f: Field): unknown {
  if (f.mapValue)
    return Object.fromEntries(
      Object.entries(f.mapValue.fields ?? {}).map(([k, v]) => [k, decode(v)]),
    );
  if (f.arrayValue) return (f.arrayValue.values ?? []).map(decode);
  if (f.integerValue !== undefined) return Number(f.integerValue);
  return f.stringValue ?? f.doubleValue ?? f.booleanValue ?? f.timestampValue ?? null;
}
const result: Record<string, unknown[]> = {};
for (const collection of ['categories', 'menuItems', 'reservations']) {
  result[collection] = [];
  let next = '';
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}`,
    );
    url.searchParams.set('pageSize', '1000');
    if (next) url.searchParams.set('pageToken', next);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 404) break;
    if (!response.ok) throw new Error(`Export ${collection} failed: HTTP ${response.status}`);
    const data = (await response.json()) as {
      documents?: { name: string; fields: Record<string, Field> }[];
      nextPageToken?: string;
    };
    result[collection].push(
      ...(data.documents ?? []).map((d) => ({
        id: d.name.split('/').pop(),
        ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, decode(v)])),
      })),
    );
    next = data.nextPageToken ?? '';
  } while (next);
}
await mkdir('migration/private', { recursive: true });
await writeFile('migration/private/firestore.export.json', JSON.stringify(result, null, 2));
process.stdout.write(
  JSON.stringify(Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.length]))) + '\n',
);
