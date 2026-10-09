import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CafeSettings, Reservation } from '../../shared/types.js';
import { statuses } from '../../shared/types.js';
import type { Services } from '../services.js';
import { actorFor, requiredActorFor, staffFor } from './auth.js';
import { AppError } from '../errors.js';
import { idParams, pagination, searchPattern, uuid } from '../validation.js';
import { bookingSchema, fingerprint, guestToken, tokenHash, validSlots } from './booking-rules.js';

const availabilityQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(50),
});

const statusChange = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(statuses),
  })
  .strict();

const staffSearchQuery = pagination.extend({
  status: z.enum(statuses).optional(),
  q: z.string().max(100).default(''),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function settings(database: Services['db']): Promise<CafeSettings> {
  const result = await database.query<CafeSettings>('select * from cafe_private.settings where id');
  return result.rows[0];
}

export async function accessibleReservation(
  request: FastifyRequest,
  id: string,
  services: Services,
): Promise<Reservation> {
  const actor = await actorFor(request, services.db, services.verify);
  const header = request.headers['x-booking-token'];
  const token = typeof header === 'string' ? header : '';
  if (token.length > 256) {
    throw new AppError(404, 'NOT_FOUND', 'Reservation not found.');
  }

  const isStaff = actor?.role === 'staff' || actor?.role === 'admin';
  const result = await services.db.query<Reservation>(
    `select reservation.*
     from public.reservations as reservation
     where reservation.id = $1
       and (
         $2::boolean
         or ($3::uuid is not null and reservation.user_id = $3)
         or exists (
           select 1 from cafe_private.guest_access as guest
           where guest.reservation_id = reservation.id and guest.token_hash = $4
         )
       )`,
    [id, isStaff, actor?.id ?? null, tokenHash(token)],
  );

  const reservation = result.rows[0];
  if (!reservation) {
    // Do not reveal whether another customer's reservation exists.
    throw new AppError(404, 'NOT_FOUND', 'Reservation not found.');
  }
  return reservation;
}

export function reservationRoutes(app: FastifyInstance, services: Services) {
  app.get('/api/settings', async () => settings(services.db));

  app.get('/api/availability', async (request) => {
    const query = availabilityQuery.parse(request.query);
    const cafeSettings = await settings(services.db);
    if (query.guests > cafeSettings.max_party_size) {
      return { slots: [], timezone: cafeSettings.timezone };
    }

    const candidateSlots = validSlots(cafeSettings, query.date);
    const result = await services.db.query<{ starts_at: string; available: boolean }>(
      `select
         slot::text as starts_at,
         cafe_private.peak_seats(
           slot, slot + make_interval(mins => $2)
         ) + $3 <= $4 as available
       from unnest($1::timestamptz[]) as slot`,
      [candidateSlots, cafeSettings.duration_minutes, query.guests, cafeSettings.capacity],
    );
    return { slots: result.rows, timezone: cafeSettings.timezone };
  });

  app.post('/api/reservations', async (request, reply) => {
    const actor = await actorFor(request, services.db, services.verify);
    const requestKey = uuid.parse(request.headers['idempotency-key']);
    const input = bookingSchema.parse(request.body);

    // Keep this order stable: the saved request fingerprint uses this JSON.
    // The validated hidden website field is not reservation data.
    const booking = {
      name: input.name,
      email: input.email,
      phone: input.phone,
      starts_at: input.starts_at,
      guests: input.guests,
      notes: input.notes,
    };
    const rateKeys = services.bookingRateKeys(request, booking.email);
    const bookingHash = fingerprint(booking);
    const privateToken = guestToken(services.config.GUEST_TOKEN_SECRET, requestKey, bookingHash);

    // One database function checks capacity and saves the booking, audit,
    // notification and retry result in the same transaction.
    const databaseResult = await services.db.query<{
      result: { reservation: Reservation; replayed: boolean };
    }>('select cafe_private.create_booking($1, $2, $3, $4, $5, $6, $7) as result', [
      actor?.id ?? null,
      requestKey,
      bookingHash,
      tokenHash(privateToken),
      booking,
      rateKeys?.ip ?? null,
      rateKeys?.email ?? null,
    ]);
    const result = databaseResult.rows[0].result;
    const httpStatus = result.replayed ? 200 : 201;

    return reply.code(httpStatus).send({
      ...result,
      guest_token: actor ? undefined : privateToken,
    });
  });

  app.get('/api/reservations/mine', async (request) => {
    const actor = await requiredActorFor(request, services.db, services.verify);
    const { page, pageSize } = pagination.parse(request.query);
    const offset = (page - 1) * pageSize;
    const reservations = await services.db.query<Reservation>(
      `select * from public.reservations
       where user_id = $1 order by starts_at desc, id limit $2 offset $3`,
      [actor.id, pageSize, offset],
    );
    const count = await services.db.query<{ total: number }>(
      'select count(*)::integer as total from public.reservations where user_id = $1',
      [actor.id],
    );
    return { items: reservations.rows, page, pageSize, total: count.rows[0].total };
  });

  app.get('/api/reservations/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    return accessibleReservation(request, id, services);
  });

  app.patch('/api/reservations/:id/status', async (request) => {
    const actor = await actorFor(request, services.db, services.verify);
    const { id } = idParams.parse(request.params);
    const { version, status } = statusChange.parse(request.body);
    const privateToken = z
      .string()
      .max(256)
      .parse(request.headers['x-booking-token'] ?? '');

    const result = await services.db.query(
      'select cafe_private.change_booking($1, $2, $3, $4, $5) as result',
      [actor?.id ?? null, tokenHash(privateToken), id, version, status],
    );
    return result.rows[0].result;
  });

  app.get('/api/admin/reservations', async (request) => {
    await staffFor(request, services.db, services.verify);
    const { page, pageSize, status, q, date } = staffSearchQuery.parse(request.query);
    const offset = (page - 1) * pageSize;
    const filters = `
      where ($1::text is null or status = $1)
        and ($2 = '' or name ilike $2 or email ilike $2 or phone ilike $2)
        and (
          $3::date is null
          or (starts_at at time zone (
            select timezone from cafe_private.settings
          ))::date = $3
        )`;
    const filterValues = [status ?? null, searchPattern(q), date ?? null];

    const reservations = await services.db.query<Reservation>(
      `select * from public.reservations ${filters}
       order by starts_at, id limit $4 offset $5`,
      [...filterValues, pageSize, offset],
    );
    const count = await services.db.query<{ total: number }>(
      `select count(*)::integer as total from public.reservations ${filters}`,
      filterValues,
    );
    return { items: reservations.rows, page, pageSize, total: count.rows[0].total };
  });

  app.get('/api/reservations/:id/audit', async (request) => {
    const { id } = idParams.parse(request.params);
    await accessibleReservation(request, id, services);
    const result = await services.db.query(
      'select * from public.reservation_audit where reservation_id = $1 order by id',
      [id],
    );
    return result.rows;
  });
}
