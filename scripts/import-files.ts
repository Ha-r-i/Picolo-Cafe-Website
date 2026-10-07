import { readFile, realpath, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { apply, option } from './admin-db.js';
const file = option('--manifest');
if (!file) throw new Error('Pass --manifest and --root with downloaded source images.');
const root = await realpath(resolve(option('--root') ?? 'migration/private/files'));
const manifest = z
  .array(
    z.object({
      source: z.string().min(1),
      file: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  )
  .parse(JSON.parse(await readFile(file, 'utf8')));
const client = apply()
  ? createClient(
      z.url().parse(process.env.SUPABASE_URL),
      z.string().min(10).parse(process.env.SUPABASE_SECRET_KEY),
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  : null;
const map: Record<string, string> = {};
for (const entry of manifest) {
  const path = await realpath(resolve(root, entry.file));
  const rel = relative(root, path);
  if (rel.startsWith('..') || isAbsolute(rel))
    throw new Error('Source file must stay inside --root.');
  const input = await readFile(path);
  if (input.length > 3145728 || createHash('sha256').update(input).digest('hex') !== entry.sha256)
    throw new Error('File size/checksum mismatch.');
  const image = sharp(input, { limitInputPixels: 16000000 });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
    throw new Error('Invalid migration image.');
  const buffer = await image
    .rotate()
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const hash = createHash('sha256').update(buffer).digest('hex');
  const dest = `menu/import/${hash}.webp`;
  if (client) {
    const { error } = await client.storage
      .from('menu-images')
      .upload(dest, buffer, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
    if (error) {
      const existing = await client.storage.from('menu-images').download(dest);
      if (
        existing.error ||
        !existing.data ||
        createHash('sha256')
          .update(Buffer.from(await existing.data.arrayBuffer()))
          .digest('hex') !== hash
      )
        throw new Error('Storage upload/validation failed.');
    }
  }
  map[entry.source] = dest;
}
if (apply()) {
  await mkdir('migration/private', { recursive: true });
  await writeFile('migration/private/image-map.export.json', JSON.stringify(map, null, 2));
}
process.stdout.write(JSON.stringify({ dryRun: !apply(), validated: manifest.length }) + '\n');
