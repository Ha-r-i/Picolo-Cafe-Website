import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../services.js';
import { actorFor, staffFor } from './auth.js';
import { pagination, uuid } from './reservations.js';
export function adminRoutes(app: FastifyInstance, s: Services) {
  app.get('/api/me', async (req) => actorFor(req, s.db, s.verify, true));
  app.get('/api/admin/metrics', async (req) => {
    await staffFor(req, s.db, s.verify);
    return (
      await s.db.query(`select count(*)::integer total_reservations,
      count(*) filter(where status='pending')::integer pending,
      count(*) filter(where status in ('pending','confirmed','seated') and (starts_at at time zone (select timezone from cafe_private.settings))::date=(now() at time zone (select timezone from cafe_private.settings))::date)::integer visits_today,
      coalesce(sum(guests) filter(where status in ('pending','confirmed','seated') and (starts_at at time zone (select timezone from cafe_private.settings))::date=(now() at time zone (select timezone from cafe_private.settings))::date),0)::integer guests_today,
      (select count(*)::integer from public.menu_items where published) published_items,
      (select count(*)::integer from cafe_private.notification_outbox where status='dead') failed_notifications,
      (select count(*)::integer from cafe_private.notification_outbox where status in ('pending','processing')) queued_notifications
      from public.reservations`)
    ).rows[0];
  });
  app.put('/api/admin/users/:id/role', async (req) => {
    const actor = await staffFor(req, s.db, s.verify, true);
    const id = uuid.parse((req.params as { id: string }).id);
    const { role } = z
      .object({ role: z.enum(['customer', 'staff', 'admin']) })
      .strict()
      .parse(req.body);
    await s.db.query('select cafe_private.set_role($1,$2,$3)', [actor.id, id, role]);
    return { id, role };
  });
  app.get('/api/admin/notifications', async (req) => {
    await staffFor(req, s.db, s.verify);
    const { page, pageSize } = pagination.parse(req.query);
    const { rows } = await s.db.query(
      'select id,reservation_id,status,attempts,last_error,created_at from cafe_private.notification_outbox order by created_at desc,id limit $1 offset $2',
      [pageSize, (page - 1) * pageSize],
    );
    return {
      items: rows,
      page,
      pageSize,
      total: (
        await s.db.query('select count(*)::integer total from cafe_private.notification_outbox')
      ).rows[0].total,
    };
  });
}
