import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../services.js';
import type { MenuItem } from '../../shared/types.js';
import { staffFor } from './auth.js';
import { idParams, pagination, searchPattern, uuid } from '../validation.js';
import { AppError } from '../errors.js';

const dietaryPreference = z.enum(['vegetarian', 'vegan', 'non_vegetarian']);

export const menuSchema = z
  .object({
    category_id: uuid,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000),
    price_paise: z.number().int().min(0).max(10000000),
    dietary: dietaryPreference,
    image_path: z
      .string()
      .regex(/^menu\/[a-zA-Z0-9/_.-]+\.webp$/)
      .nullable(),
    published: z.boolean(),
    featured: z.boolean(),
  })
  .strict();

const menuSearchQuery = pagination.extend({
  category: uuid.optional(),
  dietary: dietaryPreference.optional(),
  q: z.string().max(100).default(''),
});

const categorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
    position: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

const menuUpdateSchema = menuSchema.extend({ version: z.number().int().positive() });

// The order matches $1-$8 in the INSERT and UPDATE queries below.
function menuValues(item: z.infer<typeof menuSchema>) {
  return [
    item.category_id,
    item.name,
    item.description,
    item.price_paise,
    item.dietary,
    item.image_path,
    item.published,
    item.featured,
  ];
}

async function prepareMenuImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer, { limitInputPixels: 16000000, animated: false });
    const metadata = await image.metadata();
    const hasAllowedFormat = ['jpeg', 'png', 'webp'].includes(metadata.format ?? '');
    const isStaticImage = (metadata.pages ?? 1) === 1;
    if (!hasAllowedFormat || !isStaticImage) {
      throw new Error('Unsupported image');
    }

    // Decode and re-encode: the file extension and supplied MIME type are not proof.
    return await image
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
}

export function menuRoutes(app: FastifyInstance, services: Services) {
  const storage = createClient(services.config.SUPABASE_URL, services.config.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  }).storage;

  app.get('/api/menu', async (request) => {
    const { page, pageSize, category, dietary, q } = menuSearchQuery.parse(request.query);
    const offset = (page - 1) * pageSize;
    const filters = `
      where published
        and ($1::uuid is null or category_id = $1)
        and ($2::text is null or dietary = $2)
        and ($3 = '' or name ilike $3 or description ilike $3)`;
    const filterValues = [category ?? null, dietary ?? null, searchPattern(q)];
    const items = await services.db.query<MenuItem>(
      `select * from public.menu_items ${filters}
       order by featured desc, name, id limit $4 offset $5`,
      [...filterValues, pageSize, offset],
    );
    const count = await services.db.query<{ total: number }>(
      `select count(*)::integer as total from public.menu_items ${filters}`,
      filterValues,
    );
    return { items: items.rows, page, pageSize, total: count.rows[0].total };
  });

  app.get('/api/categories', async () => {
    const result = await services.db.query(`
      select * from public.categories
      where exists (
        select 1 from public.menu_items as item
        where item.category_id = categories.id and item.published
      )
      order by position, name
    `);
    return result.rows;
  });

  app.get('/api/admin/menu', async (request) => {
    await staffFor(request, services.db, services.verify);
    const { page, pageSize } = pagination.parse(request.query);
    const offset = (page - 1) * pageSize;
    const items = await services.db.query<MenuItem>(
      'select * from public.menu_items order by name, id limit $1 offset $2',
      [pageSize, offset],
    );
    const count = await services.db.query<{ total: number }>(
      'select count(*)::integer as total from public.menu_items',
    );
    return { items: items.rows, page, pageSize, total: count.rows[0].total };
  });

  app.get('/api/admin/categories', async (request) => {
    await staffFor(request, services.db, services.verify);
    const result = await services.db.query(
      'select * from public.categories order by position, name',
    );
    return result.rows;
  });

  app.post('/api/admin/categories', async (request, reply) => {
    await staffFor(request, services.db, services.verify);
    const category = categorySchema.parse(request.body);
    const result = await services.db.query(
      `insert into public.categories (name, slug, position)
       values ($1, $2, $3) returning *`,
      [category.name, category.slug, category.position],
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post('/api/admin/menu', async (request, reply) => {
    await staffFor(request, services.db, services.verify);
    const item = menuSchema.parse(request.body);
    const result = await services.db.query<MenuItem>(
      `insert into public.menu_items (
         category_id, name, description, price_paise, dietary, image_path, published, featured
       ) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      menuValues(item),
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.put('/api/admin/menu/:id', async (request) => {
    await staffFor(request, services.db, services.verify);
    const { id } = idParams.parse(request.params);
    const item = menuUpdateSchema.parse(request.body);
    const result = await services.db.query<MenuItem>(
      `update public.menu_items
       set category_id = $1, name = $2, description = $3, price_paise = $4,
           dietary = $5, image_path = $6, published = $7, featured = $8,
           version = version + 1, updated_at = now(), sample_data = false
       where id = $9 and version = $10
       returning *`,
      [...menuValues(item), id, item.version],
    );
    const updatedItem = result.rows[0];
    if (!updatedItem) {
      throw new AppError(409, 'STALE_VERSION', 'This menu item changed. Refresh before saving.');
    }
    return updatedItem;
  });

  app.post('/api/admin/uploads', async (request, reply) => {
    const actor = await staffFor(request, services.db, services.verify);
    await services.limit(request, 'upload', 10, 3600);

    const file = await request.file();
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new AppError(400, 'INVALID_IMAGE', 'Choose a JPEG, PNG or WebP image.');
    }
    const originalImage = await file.toBuffer();
    const preparedImage = await prepareMenuImage(originalImage);
    const path = `menu/${actor.id}/${randomUUID()}.webp`;

    const uploaded = await storage.from('menu-images').upload(path, preparedImage, {
      contentType: 'image/webp',
      upsert: false,
      cacheControl: '31536000',
    });
    if (uploaded.error) {
      throw new AppError(503, 'UPLOAD_FAILED', 'The image upload failed. Please retry.');
    }

    const publicUrl = storage.from('menu-images').getPublicUrl(path).data.publicUrl;
    return reply.code(201).send({ path, url: publicUrl });
  });
}
