import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { createHash } from 'node:crypto';
import { adminPool, apply, option } from './admin-db.js';
const text = z.string().min(1);
const timestamp = z
  .union([
    z.iso.datetime({ offset: true }),
    z.object({ _seconds: z.number(), _nanoseconds: z.number().optional() }),
  ])
  .transform((v) => (typeof v === 'string' ? v : new Date(v._seconds * 1000).toISOString()));
const schema = z.object({
  categories: z.array(
    z.object({ id: text, value: text, label: text, order: z.number().optional() }),
  ),
  menuItems: z.array(
    z.object({
      id: text,
      category: text,
      name: text,
      description: z.string().default(''),
      price: z.union([z.string(), z.number()]),
      image: z.string().optional(),
      isBestSeller: z.boolean().optional(),
      dietary: z.enum(['vegetarian', 'vegan', 'non_vegetarian']).optional(),
      createdAt: timestamp.optional(),
    }),
  ),
  reservations: z.array(
    z.object({
      id: text,
      name: text,
      email: z.email(),
      phone: text,
      date: text,
      time: text,
      guests: z.coerce.number().int().positive().max(50),
      specialRequests: z.string().default(''),
      status: z.enum([
        'pending',
        'confirmed',
        'completed',
        'cancelled',
        'rejected',
        'no_show',
        'seated',
      ]),
      createdAt: timestamp,
      userId: z.string().optional(),
    }),
  ),
});
export function legacyStart(date: string, time: string, timezone: string) {
  const result = DateTime.fromFormat(`${date} ${time.trim().toUpperCase()}`, 'yyyy-MM-dd hh:mm a', {
    zone: timezone,
  });
  const alternate = DateTime.fromFormat(`${date} ${time.trim()}`, 'yyyy-MM-dd HH:mm', {
    zone: timezone,
  });
  const valid = result.isValid ? result : alternate;
  if (!valid.isValid) throw new Error('Invalid legacy date/time');
  return valid.toUTC().toISO()!;
}
export function pricePaise(value: string | number) {
  const price = typeof value === 'number' ? value : Number(value.replace(/[₹,\s]/g, ''));
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    price > 100000 ||
    Math.abs(price * 100 - Math.round(price * 100)) > 0.0001
  )
    throw new Error('Invalid legacy price');
  return Math.round(price * 100);
}
// Exports with unexpected fields are retained in the operator's original file;
// unknown statuses, missing timestamps and unmapped categories fail closed.
export async function importLegacy(file: string, dryRun: boolean) {
  const data = schema.parse(JSON.parse(await readFile(file, 'utf8')));
  const imageMap = option('--image-map')
    ? (JSON.parse(await readFile(option('--image-map')!, 'utf8')) as Record<string, string>)
    : {};
  const userMap = option('--user-map')
    ? (JSON.parse(await readFile(option('--user-map')!, 'utf8')) as Record<string, string>)
    : {};
  for (const array of [data.categories, data.menuItems, data.reservations])
    if (new Set(array.map((v) => v.id)).size !== array.length)
      throw new Error('Duplicate legacy IDs in export');
  const db = adminPool();
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(614022)');
    await client.query("select set_config('cafe.actor_kind','migration',true)");
    const settings = (await client.query('select * from cafe_private.settings where id for update'))
      .rows[0];
    const categories = new Map<string, string>();
    async function source(kind: string, id: string, data: unknown) {
      const checksum = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      const existing = (
        await client.query(
          'select checksum from cafe_private.imported_sources where kind=$1 and legacy_id=$2',
          [kind, id],
        )
      ).rows[0];
      if (existing && existing.checksum !== checksum)
        throw new Error(
          `Source changed after import: ${kind}/${id}. Review a delta migration instead of overwriting live data.`,
        );
      await client.query(
        'insert into cafe_private.imported_sources(kind,legacy_id,checksum) values($1,$2,$3) on conflict do nothing',
        [kind, id, checksum],
      );
    }
    for (const c of data.categories) {
      await source('category', c.id, c);
      const existing = (
        await client.query('select id from public.categories where legacy_id=$1', [c.id])
      ).rows[0];
      if (existing) categories.set(c.value, existing.id);
      else
        categories.set(
          c.value,
          (
            await client.query(
              'insert into public.categories(slug,name,position,legacy_id) values($1,$2,$3,$4) returning id',
              [`legacy-${c.id.replace(/[^a-zA-Z0-9-]/g, '-')}`, c.label, c.order ?? 0, c.id],
            )
          ).rows[0].id,
        );
    }
    let skipped = 0;
    for (const m of data.menuItems) {
      await source('menu', m.id, { ...m, mappedImage: m.image ? imageMap[m.image] : null });
      const category = categories.get(m.category);
      if (!category) throw new Error(`Unmapped category for legacy item ${m.id}`);
      if (m.image && !imageMap[m.image])
        throw new Error(`Migrate stored image before importing item ${m.id}; supply --image-map.`);
      const res = await client.query(
        'insert into public.menu_items(category_id,name,description,price_paise,image_path,published,featured,dietary,legacy_id,created_at) values($1,$2,$3,$4,$5,true,$6,$7,$8,coalesce($9::timestamptz,now())) on conflict(legacy_id) do nothing',
        [
          category,
          m.name,
          m.description,
          pricePaise(m.price),
          m.image ? imageMap[m.image] : null,
          m.isBestSeller ?? false,
          m.dietary ?? 'vegetarian',
          m.id,
          m.createdAt ?? null,
        ],
      );
      if (res.rowCount === 0) skipped++;
    }
    for (const r of data.reservations) {
      await source('reservation', r.id, { ...r, mappedUser: r.userId ? userMap[r.userId] : null });
      if (r.userId && !userMap[r.userId])
        throw new Error(`Unmapped explicit user relationship for reservation ${r.id}`);
      const start = legacyStart(r.date, r.time, settings.timezone);
      const res = await client.query(
        'insert into public.reservations(user_id,name,email,phone,starts_at,ends_at,guests,notes,status,legacy_id,created_at,updated_at) values($1,$2,$3,$4,$5,$5::timestamptz+make_interval(mins=>$6),$7,$8,$9,$10,$11,$11) on conflict(legacy_id) do nothing',
        [
          r.userId ? z.uuid().parse(userMap[r.userId]) : null,
          r.name,
          r.email.toLowerCase(),
          r.phone,
          start,
          settings.duration_minutes,
          r.guests,
          r.specialRequests,
          r.status,
          r.id,
          r.createdAt,
        ],
      );
      if (res.rowCount === 0) skipped++;
    }
    const counts = await client.query(
      'select (select count(*) from public.menu_items where legacy_id is not null)::integer menu,(select count(*) from public.reservations where legacy_id is not null)::integer reservations',
    );
    await client.query(dryRun ? 'rollback' : 'commit');
    process.stdout.write(
      JSON.stringify({
        dryRun,
        input: { menu: data.menuItems.length, reservations: data.reservations.length },
        alreadyImported: skipped,
        target: counts.rows[0],
      }) + '\n',
    );
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/import-legacy.ts')) {
  const file = option('--file');
  if (!file) throw new Error('Pass --file migration/private/firestore.export.json');
  await importLegacy(file, !apply());
}
