import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { apply, option } from './admin-db.js';
const file = option('--file');
if (!file) throw new Error('Pass --file Firebase auth export JSON.');
const { users } = z
  .object({
    users: z.array(
      z.object({
        localId: z.string().min(1),
        email: z.email(),
        emailVerified: z.boolean().default(false),
        disabled: z.boolean().default(false),
        createdAt: z.string().regex(/^\d+$/).optional(),
        lastSignedInAt: z.string().regex(/^\d+$/).optional(),
      }),
    ),
  })
  .parse(JSON.parse(await readFile(file, 'utf8')));
if (new Set(users.map((u) => u.email.toLowerCase())).size !== users.length)
  throw new Error('Duplicate source emails must be reviewed before import.');
if (!apply()) {
  process.stdout.write(
    JSON.stringify({
      dryRun: true,
      total: users.length,
      disabled: users.filter((u) => u.disabled).length,
      strategy: 'new random password; explicit reset after cutover; no email sent by import',
    }) + '\n',
  );
  process.exit(0);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
  throw new Error('Set server Supabase URL and secret key.');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const existing = [];
for (let page = 1; ; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  existing.push(...data.users);
  if (data.users.length < 1000) break;
}
const map: Record<string, string> = {};
for (const user of users) {
  const target = existing.find((u) => u.email?.toLowerCase() === user.email.toLowerCase());
  if (target) {
    if (
      target.app_metadata?.legacy_firebase_uid !== user.localId ||
      target.app_metadata?.migration_source !== 'piccolo_firebase_v1'
    )
      throw new Error(
        'An existing email requires manual verified account linking. Import stopped.',
      );
    map[user.localId] = target.id;
    continue;
  }
  const { data, error } = await client.auth.admin.createUser({
    email: user.email,
    password: randomBytes(48).toString('base64url'),
    email_confirm: user.emailVerified,
    ban_duration: user.disabled ? '876000h' : 'none',
    // app_metadata is server-owned; user_metadata is editable by the customer
    // and therefore cannot prove a previous importer created this account.
    app_metadata: {
      migration_source: 'piccolo_firebase_v1',
      legacy_firebase_uid: user.localId,
      legacy_created_at: user.createdAt,
      legacy_last_signed_in_at: user.lastSignedInAt,
    },
  });
  if (error || !data.user)
    throw new Error('User creation failed; rerun safely after investigating provider logs.');
  map[user.localId] = data.user.id;
}
await mkdir('migration/private', { recursive: true });
await writeFile('migration/private/user-map.export.json', JSON.stringify(map, null, 2));
process.stdout.write(
  `Imported/mapped ${Object.keys(map).length} users. Passwords and sessions were not transferred. No roles promoted.\n`,
);
