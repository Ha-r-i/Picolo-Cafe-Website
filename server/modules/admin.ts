import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../services.js';
import { requiredActorFor, staffFor } from './auth.js';
import { idParams, pagination } from '../validation.js';

const roleChange = z.object({ role: z.enum(['customer', 'staff', 'admin']) }).strict();

export function adminRoutes(app: FastifyInstance, services: Services) {
  app.get('/api/me', async (request) => {
    return requiredActorFor(request, services.db, services.verify);
  });

  app.get('/api/admin/metrics', async (request) => {
    await staffFor(request, services.db, services.verify);

    // The CTE names the same "active visit today" rule once, rather than
    // repeating that condition for both visit and guest counts.
    const result = await services.db.query(`
      with visits as (
        select guests, status,
          status in ('pending', 'confirmed', 'seated')
          and (starts_at at time zone (select timezone from cafe_private.settings))::date
            = (now() at time zone (select timezone from cafe_private.settings))::date
          as active_today
        from public.reservations
      )
      select
        count(*)::integer as total_reservations,
        count(*) filter (where status = 'pending')::integer as pending,
        count(*) filter (where active_today)::integer as visits_today,
        coalesce(sum(guests) filter (where active_today), 0)::integer as guests_today,
        (select count(*)::integer from public.menu_items where published) as published_items,
        (select count(*)::integer from cafe_private.notification_outbox
          where status = 'dead') as failed_notifications,
        (select count(*)::integer from cafe_private.notification_outbox
          where status in ('pending', 'processing')) as queued_notifications
      from visits
    `);
    return result.rows[0];
  });

  app.put('/api/admin/users/:id/role', async (request) => {
    const administrator = await staffFor(request, services.db, services.verify, true);
    const { id } = idParams.parse(request.params);
    const { role } = roleChange.parse(request.body);

    // PostgreSQL also protects the last administrator from being demoted.
    await services.db.query('select cafe_private.set_role($1, $2, $3)', [
      administrator.id,
      id,
      role,
    ]);
    return { id, role };
  });

  app.get('/api/admin/notifications', async (request) => {
    await staffFor(request, services.db, services.verify);
    const { page, pageSize } = pagination.parse(request.query);
    const offset = (page - 1) * pageSize;
    const events = await services.db.query(
      `select id, reservation_id, status, attempts, last_error, created_at
       from cafe_private.notification_outbox
       order by created_at desc, id limit $1 offset $2`,
      [pageSize, offset],
    );
    const count = await services.db.query<{ total: number }>(
      'select count(*)::integer as total from cafe_private.notification_outbox',
    );
    return { items: events.rows, page, pageSize, total: count.rows[0].total };
  });
}
