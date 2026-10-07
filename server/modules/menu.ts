import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../services.js';
import { staffFor } from './auth.js';
import { pagination, uuid } from './reservations.js';
import { AppError } from '../errors.js';
export const menuSchema = z
  .object({
    category_id: uuid,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000),
    price_paise: z.number().int().min(0).max(10000000),
    dietary: z.enum(['vegetarian', 'vegan', 'non_vegetarian']),
    image_path: z
      .string()
      .regex(/^menu\/[a-zA-Z0-9/_.-]+\.webp$/)
      .nullable(),
    published: z.boolean(),
    featured: z.boolean(),
  })
  .strict();
export function menuRoutes(app: FastifyInstance, s: Services) {
  const storage = createClient(s.config.SUPABASE_URL, s.config.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  }).storage;
  app.get('/api/menu', async (req) => {
    const { page, pageSize, category, dietary, q } = pagination
      .extend({
        category: uuid.optional(),
        dietary: z.enum(['vegetarian', 'vegan', 'non_vegetarian']).optional(),
        q: z.string().max(100).default(''),
      })
      .parse(req.query);
    const where = `where published and ($1::uuid is null or category_id=$1) and ($2::text is null or dietary=$2) and ($3='' or name ilike $3 or description ilike $3)`;
    const args = [category ?? null, dietary ?? null, q ? `%${q.replace(/[%_\\]/g, '\\$&')}%` : ''];
    const { rows } = await s.db.query(
      `select * from public.menu_items ${where} order by featured desc,name,id limit $4 offset $5`,
      [...args, pageSize, (page - 1) * pageSize],
    );
    const count = await s.db.query(
      `select count(*)::integer total from public.menu_items ${where}`,
      args,
    );
    return { items: rows, page, pageSize, total: count.rows[0].total };
  });
  app.get(
    '/api/categories',
    async () =>
      (
        await s.db.query(
          'select * from public.categories where exists(select 1 from public.menu_items m where m.category_id=categories.id and m.published) order by position,name',
        )
      ).rows,
  );
  app.get('/api/admin/menu', async (req) => {
    await staffFor(req, s.db, s.verify);
    const { page, pageSize } = pagination.parse(req.query);
    const { rows } = await s.db.query(
      'select * from public.menu_items order by name,id limit $1 offset $2',
      [pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows,
      page,
      pageSize,
      total: (await s.db.query('select count(*)::integer total from public.menu_items')).rows[0]
        .total,
    };
  });
  app.get('/api/admin/categories', async (req) => {
    await staffFor(req, s.db, s.verify);
    return (await s.db.query('select * from public.categories order by position,name')).rows;
  });
  app.post('/api/admin/categories', async (req, reply) => {
    await staffFor(req, s.db, s.verify);
    const v = z
      .object({
        name: z.string().trim().min(1).max(100),
        slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
        position: z.number().int().min(0).max(1000).default(0),
      })
      .strict()
      .parse(req.body);
    return reply
      .code(201)
      .send(
        (
          await s.db.query(
            'insert into public.categories(name,slug,position) values($1,$2,$3) returning *',
            [v.name, v.slug, v.position],
          )
        ).rows[0],
      );
  });
  app.post('/api/admin/menu', async (req, reply) => {
    await staffFor(req, s.db, s.verify);
    const v = menuSchema.parse(req.body);
    return reply
      .code(201)
      .send(
        (
          await s.db.query(
            'insert into public.menu_items(category_id,name,description,price_paise,dietary,image_path,published,featured) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',
            Object.values(v),
          )
        ).rows[0],
      );
  });
  app.put('/api/admin/menu/:id', async (req) => {
    await staffFor(req, s.db, s.verify);
    const id = uuid.parse((req.params as { id: string }).id);
    const { version, ...v } = menuSchema
      .extend({ version: z.number().int().positive() })
      .parse(req.body);
    const { rows } = await s.db.query(
      'update public.menu_items set category_id=$1,name=$2,description=$3,price_paise=$4,dietary=$5,image_path=$6,published=$7,featured=$8,version=version+1,updated_at=now(),sample_data=false where id=$9 and version=$10 returning *',
      [...Object.values(v), id, version],
    );
    if (!rows[0])
      throw new AppError(409, 'STALE_VERSION', 'This menu item changed. Refresh before saving.');
    return rows[0];
  });
  app.post('/api/admin/uploads', async (req, reply) => {
    const actor = await staffFor(req, s.db, s.verify);
    await s.limit(req, 'upload', 10, 3600);
    const file = await req.file();
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new AppError(400, 'INVALID_IMAGE', 'Choose a JPEG, PNG or WebP image.');
    const buffer = await file.toBuffer();
    let output: Buffer;
    try {
      const image = sharp(buffer, { limitInputPixels: 16000000, animated: false });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
        throw new Error('format');
      output = await image
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new AppError(
        400,
        'INVALID_IMAGE',
        'That image could not be read. Choose a smaller static image.',
      );
    }
    const path = `menu/${actor.id}/${randomUUID()}.webp`;
    const { error } = await storage
      .from('menu-images')
      .upload(path, output, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
    if (error) throw new AppError(503, 'UPLOAD_FAILED', 'The image upload failed. Please retry.');
    return reply
      .code(201)
      .send({ path, url: storage.from('menu-images').getPublicUrl(path).data.publicUrl });
  });
}
