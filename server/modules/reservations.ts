import { createHash, createHmac } from 'node:crypto';
import { DateTime } from 'luxon';
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CafeSettings, Reservation } from '../../shared/types.js';
import { statuses } from '../../shared/types.js';
import type { Services } from '../services.js';
import { actorFor, staffFor } from './auth.js';
import { AppError } from '../errors.js';
export const bookingSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/),
    starts_at: z.iso.datetime({ offset: true }).transform((v) => new Date(v).toISOString()),
    guests: z.number().int().min(1).max(50),
    notes: z.string().trim().max(1000).default(''),
    website: z.string().max(0).optional(),
  })
  .strict();
export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const uuid = z.uuid();
export const fingerprint = (input: unknown) =>
  createHash('sha256').update(JSON.stringify(input)).digest('hex');
export const guestToken = (secret: string, key: string, hash: string) =>
  createHmac('sha256', secret).update(`${key}:${hash}`).digest('base64url');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export async function settings(db: Services['db']): Promise<CafeSettings> {
  return (await db.query<CafeSettings>('select * from cafe_private.settings where id')).rows[0];
}
export function validSlots(s: CafeSettings, date: string, now: DateTime = DateTime.now()) {
  const day = DateTime.fromISO(date, { zone: s.timezone });
  if (
    !day.isValid ||
    day.toISODate() !== date ||
    day.startOf('day') < now.setZone(s.timezone).startOf('day') ||
    day > now.setZone(s.timezone).startOf('day').plus({ days: s.horizon_days })
  )
    return [];
  const hours = s.opening_hours[String(day.weekday % 7)];
  if (!hours) return [];
  const close = DateTime.fromISO(`${date}T${hours.close}`, { zone: s.timezone });
  const result: string[] = [];
  for (
    let t = DateTime.fromISO(`${date}T${hours.open}`, { zone: s.timezone });
    t.plus({ minutes: s.duration_minutes }) <= close;
    t = t.plus({ minutes: s.slot_minutes })
  ) {
    if (t >= now.plus({ minutes: s.lead_minutes })) result.push(t.toUTC().toISO()!);
  }
  return result;
}
export async function accessibleReservation(req: FastifyRequest, id: string, s: Services) {
  const actor = await actorFor(req, s.db, s.verify);
  const token =
    typeof req.headers['x-booking-token'] === 'string' ? req.headers['x-booking-token'] : '';
  if (token.length > 256) throw new AppError(404, 'NOT_FOUND', 'Reservation not found.');
  const { rows } = await s.db.query<Reservation>(
    `select r.* from public.reservations r where r.id=$1 and
    ($2::boolean or ($3::uuid is not null and r.user_id=$3) or exists(select 1 from cafe_private.guest_access g where g.reservation_id=r.id and g.token_hash=$4))`,
    [id, actor && ['staff', 'admin'].includes(actor.role), actor?.id ?? null, tokenHash(token)],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Reservation not found.');
  return rows[0];
}
export function reservationRoutes(app: FastifyInstance, s: Services) {
  app.get('/api/settings', async () => settings(s.db));
  app.get('/api/availability', async (req) => {
    const { date, guests } = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        guests: z.coerce.number().int().min(1).max(50),
      })
      .parse(req.query);
    const config = await settings(s.db);
    const slots = validSlots(config, date);
    if (guests > config.max_party_size) return { slots: [], timezone: config.timezone };
    const { rows } = await s.db.query<{ starts_at: string; available: boolean }>(
      `select t::text starts_at, cafe_private.peak_seats(t,t+make_interval(mins=>$2))+$3<=$4 available from unnest($1::timestamptz[]) t`,
      [slots, config.duration_minutes, guests, config.capacity],
    );
    return { slots: rows, timezone: config.timezone };
  });
  app.post('/api/reservations', async (req, reply) => {
    const actor = await actorFor(req, s.db, s.verify);
    const key = uuid.parse(req.headers['idempotency-key']);
    const parsed = bookingSchema.parse(req.body);
    const { website: _trap, ...data } = parsed;
    void _trap;
    const rate = s.bookingRateKeys(req, data.email);
    const hash = fingerprint(data);
    const token = guestToken(s.config.GUEST_TOKEN_SECRET, key, hash);
    const { rows } = await s.db.query<{ result: { reservation: Reservation; replayed: boolean } }>(
      'select cafe_private.create_booking($1,$2,$3,$4,$5,$6,$7) result',
      [actor?.id ?? null, key, hash, tokenHash(token), data, rate?.ip ?? null, rate?.email ?? null],
    );
    const result = rows[0].result;
    return reply
      .code(result.replayed ? 200 : 201)
      .send({ ...result, guest_token: actor ? undefined : token });
  });
  app.get('/api/reservations/mine', async (req) => {
    const actor = await actorFor(req, s.db, s.verify, true);
    const { page, pageSize } = pagination.parse(req.query);
    const { rows } = await s.db.query<Reservation>(
      'select * from public.reservations where user_id=$1 order by starts_at desc,id limit $2 offset $3',
      [actor!.id, pageSize, (page - 1) * pageSize],
    );
    const count = await s.db.query(
      'select count(*)::integer total from public.reservations where user_id=$1',
      [actor!.id],
    );
    return { items: rows, page, pageSize, total: count.rows[0].total };
  });
  app.get('/api/reservations/:id', async (req) =>
    accessibleReservation(req, uuid.parse((req.params as { id: string }).id), s),
  );
  app.patch('/api/reservations/:id/status', async (req) => {
    const actor = await actorFor(req, s.db, s.verify);
    const id = uuid.parse((req.params as { id: string }).id);
    const { version, status } = z
      .object({ version: z.number().int().positive(), status: z.enum(statuses) })
      .strict()
      .parse(req.body);
    const token = z
      .string()
      .max(256)
      .parse(req.headers['x-booking-token'] ?? '');
    return (
      await s.db.query('select cafe_private.change_booking($1,$2,$3,$4,$5) result', [
        actor?.id ?? null,
        tokenHash(token),
        id,
        version,
        status,
      ])
    ).rows[0].result;
  });
  app.get('/api/admin/reservations', async (req) => {
    await staffFor(req, s.db, s.verify);
    const { page, pageSize, status, q, date } = pagination
      .extend({
        status: z.enum(statuses).optional(),
        q: z.string().max(100).default(''),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(req.query);
    const where = `where ($1::text is null or status=$1) and ($2='' or name ilike $2 or email ilike $2 or phone ilike $2) and ($3::date is null or (starts_at at time zone (select timezone from cafe_private.settings))::date=$3)`;
    const args = [status ?? null, q ? `%${q.replace(/[%_\\]/g, '\\$&')}%` : '', date ?? null];
    const { rows } = await s.db.query(
      `select * from public.reservations ${where} order by starts_at,id limit $4 offset $5`,
      [...args, pageSize, (page - 1) * pageSize],
    );
    const count = await s.db.query(
      `select count(*)::integer total from public.reservations ${where}`,
      args,
    );
    return { items: rows, page, pageSize, total: count.rows[0].total };
  });
  app.get('/api/reservations/:id/audit', async (req) => {
    const id = uuid.parse((req.params as { id: string }).id);
    await accessibleReservation(req, id, s);
    return (
      await s.db.query(
        'select * from public.reservation_audit where reservation_id=$1 order by id',
        [id],
      )
    ).rows;
  });
}
