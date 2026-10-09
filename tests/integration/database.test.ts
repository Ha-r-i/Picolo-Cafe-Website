import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../scripts/migrations';
import { importLegacy } from '../../scripts/import-legacy';
import { buildApp } from '../../server/app';
import { processOne } from '../../server/modules/notifications';
import type { Config } from '../../server/config';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.includes('test'))
  throw new Error(
    'Set TEST_DATABASE_URL to an isolated database whose name contains test. Never point tests at production.',
  );
const owner = new pg.Pool({ connectionString: url, max: 5 });
const config: Config = {
  DATABASE_URL: url,
  DATABASE_SSL: 'false',
  DATABASE_POOL_MAX: 10,
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'test-only-public-key',
  SUPABASE_SECRET_KEY: 'test-only-secret-key',
  GUEST_TOKEN_SECRET: 'local-guest-secret-longer-than-32-characters',
  RATE_LIMIT_SECRET: 'local-limit-secret-longer-than-32-characters',
  WEB_ORIGIN: 'http://localhost:3000',
  PORT: 3001,
  HOST: '127.0.0.1',
  TRUST_PROXY: '',
  LOG_LEVEL: 'silent',
  RESEND_API_KEY: '',
  EMAIL_FROM: '',
  WORKER_POLL_MS: 1000,
};
const ids = {
  customer: randomUUID(),
  other: randomUUID(),
  staff: randomUUID(),
  admin: randomUUID(),
};
let runtime: pg.Pool;
let second: pg.Pool;
let app: Awaited<ReturnType<typeof buildApp>>;
let app2: typeof app;
const start = DateTime.now()
  .setZone('Asia/Kolkata')
  .plus({ days: 7 })
  .set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
const booking = (guests = 1, time = start) => ({
  name: 'Test Guest',
  email: 'guest@example.test',
  phone: '+91 98765 43210',
  starts_at: time.toUTC().toISO(),
  guests,
  notes: '',
});
const create = (data = booking(), key = randomUUID(), token?: keyof typeof ids, target = app) =>
  target.inject({
    method: 'POST',
    url: '/api/reservations',
    headers: { 'Idempotency-Key': key, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    payload: data,
  });
const change = (
  id: string,
  version: number,
  status: string,
  token?: keyof typeof ids,
  guest?: string,
) =>
  app.inject({
    method: 'PATCH',
    url: `/api/reservations/${id}/status`,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : { 'X-Booking-Token': guest ?? '' }),
    },
    payload: { version, status },
  });
beforeAll(async () => {
  // Requires a fresh test schema; setup script supplies auth/storage shapes.
  const fresh = (await owner.query("select to_regclass('public.reservations') name")).rows[0].name;
  if (!fresh) {
    await runMigrations(owner, false);
    expect(
      (await owner.query("select to_regclass('public.reservations') name")).rows[0].name,
    ).toBeNull();
  }
  await runMigrations(owner, true);
  await runMigrations(owner, true);
  await owner.query("alter role cafe_api login password 'local-runtime-test-password'");
  for (const [role, id] of Object.entries(ids)) {
    await owner.query(
      'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()) on conflict(id) do nothing',
      [id, `${role}@example.test`],
    );
    if (['staff', 'admin'].includes(role))
      await owner.query('update public.profiles set role=$2 where id=$1', [id, role]);
  }
  const runtimeUrl = new URL(url!);
  runtimeUrl.username = 'cafe_api';
  runtimeUrl.password = 'local-runtime-test-password';
  runtime = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 10 });
  second = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 10 });
  const verify = async (token: string) => ids[token as keyof typeof ids] ?? null;
  app = await buildApp(config, runtime, { verify, rateLimits: false, logger: false });
  app2 = await buildApp(config, second, { verify, rateLimits: false, logger: false });
}, 30000);
beforeEach(async () => {
  await owner.query('truncate public.reservations restart identity cascade');
  await owner.query(
    'update cafe_private.settings set capacity=4,max_party_size=4,lead_minutes=0,cancellation_minutes=120,duration_minutes=90 where id',
  );
});
afterAll(async () => {
  await app?.close();
  await app2?.close();
  await runtime?.end();
  await second?.end();
  await owner.end();
});
describe('fresh database and atomic booking rules', () => {
  it('seeds twice safely and retains sample labels', async () => {
    const sql = await readFile('supabase/seed.sql', 'utf8');
    await owner.query(sql);
    await owner.query(sql);
    expect(
      (await owner.query('select count(*)::integer n from public.menu_items where sample_data'))
        .rows[0].n,
    ).toBe(6);
  });
  it('validates a dry import, preserves timestamps/statuses, reruns safely and rejects source drift', async () => {
    const suffix = randomUUID();
    await mkdir('.local-backup', { recursive: true });
    const file = `.local-backup/${suffix}.export.json`;
    const data = {
      categories: [{ id: suffix, value: 'legacyCoffee', label: 'Legacy coffee' }],
      menuItems: [
        {
          id: suffix,
          category: 'legacyCoffee',
          name: 'Imported coffee',
          price: '₹125',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      reservations: [
        {
          id: suffix,
          name: 'Imported Guest',
          email: 'legacy@example.test',
          phone: '9876543210',
          date: '2024-01-02',
          time: '12:30 PM',
          guests: '2',
          status: 'completed',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    };
    await writeFile(file, JSON.stringify(data));
    const previous = process.env.ADMIN_DATABASE_URL;
    process.env.ADMIN_DATABASE_URL = url;
    try {
      await importLegacy(file, true);
      expect(
        (await owner.query('select id from public.reservations where legacy_id=$1', [suffix]))
          .rowCount,
      ).toBe(0);
      await importLegacy(file, false);
      await importLegacy(file, false);
      const rows = (
        await owner.query(
          'select status,starts_at,created_at from public.reservations where legacy_id=$1',
          [suffix],
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('completed');
      expect(rows[0].starts_at.toISOString()).toBe('2024-01-02T07:00:00.000Z');
      expect(rows[0].created_at.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(
        (await owner.query('select count(*)::integer n from cafe_private.notification_outbox'))
          .rows[0].n,
      ).toBe(0);
      data.menuItems[0].name = 'Changed after import';
      await writeFile(file, JSON.stringify(data));
      await expect(importLegacy(file, false)).rejects.toThrow('Source changed after import');
    } finally {
      if (previous === undefined) delete process.env.ADMIN_DATABASE_URL;
      else process.env.ADMIN_DATABASE_URL = previous;
    }
  });
  it('allows exactly one of 20 simultaneous requests for the last seat across two instances', async () => {
    expect((await create(booking(3))).statusCode).toBe(201);
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        create(booking(), randomUUID(), undefined, i % 2 ? app : app2),
      ),
    );
    expect(responses.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.json().error?.code === 'CAPACITY_EXCEEDED')).toHaveLength(19);
    expect(
      (await owner.query('select sum(guests)::integer total from public.reservations')).rows[0]
        .total,
    ).toBe(4);
  });
  it('calculates peak overlap, accepts adjacent intervals and rejects intersecting excess', async () => {
    expect((await create(booking(2))).statusCode).toBe(201);
    expect((await create(booking(2, start.plus({ minutes: 90 })))).statusCode).toBe(201);
    expect((await create(booking(2, start.plus({ minutes: 30 })))).statusCode).toBe(201);
    expect((await create(booking(1, start.plus({ minutes: 60 })))).json().error.code).toBe(
      'CAPACITY_EXCEEDED',
    );
  });
  it('replays duplicate requests concurrently without duplicating history or outbox', async () => {
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 10 }, () => create(booking(), key)));
    expect(new Set(responses.map((r) => r.json().reservation.id)).size).toBe(1);
    expect(responses.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(new Set(responses.map((r) => r.json().guest_token)).size).toBe(1);
    expect(
      (await owner.query('select count(*)::integer n from cafe_private.notification_outbox'))
        .rows[0].n,
    ).toBe(1);
    expect(
      (await owner.query('select count(*)::integer n from public.reservation_audit')).rows[0].n,
    ).toBe(1);
    expect((await create(booking(2), key)).json().error.code).toBe('IDEMPOTENCY_MISMATCH');
  });
  it('does not charge the booking abuse budget again when a successful request is replayed', async () => {
    const limited = await buildApp(config, runtime, { verify: async () => null, logger: false });
    const key = randomUUID();
    try {
      const responses = [];
      for (let i = 0; i < 12; i++) responses.push(await create(booking(), key, undefined, limited));
      expect(responses.every((r) => [200, 201].includes(r.statusCode))).toBe(true);
      expect(responses.filter((r) => r.statusCode === 201)).toHaveLength(1);
    } finally {
      await limited.close();
    }
  });
  it('rejects unsafe capacity reductions and invalid opening hours', async () => {
    await create(booking(4));
    await expect(
      owner.query('update cafe_private.settings set capacity=3,max_party_size=3 where id'),
    ).rejects.toThrow('Capacity cannot be lowered');
    await expect(
      owner.query(`update cafe_private.settings set opening_hours='{"0":null}' where id`),
    ).rejects.toThrow('Specify all seven');
  });
  it('keeps guest tokens usable after signing in without granting cross-user access', async () => {
    const guest = (await create()).json();
    expect(
      (
        await app.inject({
          url: `/api/reservations/${guest.reservation.id}`,
          headers: { Authorization: 'Bearer other', 'X-Booking-Token': guest.guest_token },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await change(guest.reservation.id, 1, 'cancelled', 'other', guest.guest_token)).statusCode,
    ).toBe(404);
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/reservations/${guest.reservation.id}/status`,
      headers: { Authorization: 'Bearer other', 'X-Booking-Token': guest.guest_token },
      payload: { version: 1, status: 'cancelled' },
    });
    expect(response.statusCode).toBe(200);
  });
  it('rejects reuse by a different actor and booking fields outside the rules', async () => {
    const key = randomUUID();
    await create(booking(), key, 'customer');
    expect((await create(booking(), key, 'other')).json().error.code).toBe('IDEMPOTENCY_MISMATCH');
    expect((await create(booking(5))).statusCode).toBe(422);
    expect((await create(booking(1, start.set({ hour: 22 })))).statusCode).toBe(422);
    expect((await create(booking(1, start.set({ minute: 7 })))).statusCode).toBe(422);
  });
  it('cancels a guest booking with its private token and immediately releases capacity', async () => {
    const saved = (await create(booking(4))).json();
    expect((await create()).statusCode).toBe(409);
    const cancelled = await change(
      saved.reservation.id,
      1,
      'cancelled',
      undefined,
      saved.guest_token,
    );
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().version).toBe(2);
    expect((await create(booking(4))).statusCode).toBe(201);
    const events = (
      await owner.query(
        'select from_status,to_status,actor_kind from public.reservation_audit where reservation_id=$1 order by id',
        [saved.reservation.id],
      )
    ).rows;
    expect(events).toEqual([
      { from_status: null, to_status: 'pending', actor_kind: 'guest' },
      { from_status: 'pending', to_status: 'cancelled', actor_kind: 'guest' },
    ]);
  });
  it('rejects stale staff edits, invalid transitions and early arrivals', async () => {
    const r = (await create()).json().reservation;
    expect((await change(r.id, 1, 'completed', 'staff')).json().error.code).toBe(
      'INVALID_TRANSITION',
    );
    expect((await change(r.id, 1, 'confirmed', 'staff')).statusCode).toBe(200);
    expect((await change(r.id, 1, 'cancelled', 'staff')).json().error.code).toBe('STALE_VERSION');
    expect((await change(r.id, 2, 'seated', 'staff')).json().error.code).toBe(
      'TOO_EARLY_FOR_STATUS',
    );
  });
  it('enforces cancellation deadlines and terminal states', async () => {
    const near = DateTime.now()
      .setZone('Asia/Kolkata')
      .plus({ days: 1 })
      .set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
    await owner.query('update cafe_private.settings set cancellation_minutes=10080 where id');
    const r = (await create(booking(1, near), randomUUID(), 'customer')).json().reservation;
    expect((await change(r.id, 1, 'cancelled', 'customer')).json().error.code).toBe('FORBIDDEN');
    expect((await change(r.id, 1, 'rejected', 'staff')).statusCode).toBe(200);
    expect((await change(r.id, 2, 'confirmed', 'staff')).json().error.code).toBe(
      'INVALID_TRANSITION',
    );
  });
});
describe('authorization and direct database access', () => {
  it('reports cafe-local visit totals and notification counts only to staff', async () => {
    const today = DateTime.now().setZone('Asia/Kolkata').startOf('day');
    const visits = [
      { guests: 1, status: 'pending', starts: today.set({ hour: 10 }) },
      { guests: 2, status: 'confirmed', starts: today.set({ hour: 12 }) },
      { guests: 3, status: 'seated', starts: today.set({ hour: 15 }) },
      { guests: 4, status: 'completed', starts: today.set({ hour: 17 }) },
      { guests: 1, status: 'pending', starts: today.plus({ days: 1 }).set({ hour: 10 }) },
    ];
    // Operator-created fixtures cover historical/current states without depending
    // on whether the cafe is open at the instant this test runs.
    for (const visit of visits) {
      await owner.query(
        `insert into public.reservations
         (name, email, phone, starts_at, ends_at, guests, status)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'Metrics Guest',
          'metrics@example.test',
          '9876543210',
          visit.starts.toUTC().toISO(),
          visit.starts.plus({ minutes: 90 }).toUTC().toISO(),
          visit.guests,
          visit.status,
        ],
      );
    }
    // Operator fixtures suppress mail. Use actual API bookings for outbox totals.
    expect((await create()).statusCode).toBe(201);
    expect((await create()).statusCode).toBe(201);
    await owner.query(
      `update cafe_private.notification_outbox set status = 'dead'
       where id = (select id from cafe_private.notification_outbox order by id limit 1)`,
    );
    expect((await app.inject({ url: '/api/admin/metrics' })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          url: '/api/admin/metrics',
          headers: { Authorization: 'Bearer customer' },
        })
      ).statusCode,
    ).toBe(403);
    const response = await app.inject({
      url: '/api/admin/metrics',
      headers: { Authorization: 'Bearer staff' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total_reservations: 7,
      pending: 4,
      visits_today: 3,
      guests_today: 6,
      failed_notifications: 1,
      queued_notifications: 1,
    });
    const publicMenu = await app.inject({ url: '/api/menu' });
    expect(response.json().published_items).toBe(publicMenu.json().total);
  });
  it('authorizes menu publishing and protects stale content edits', async () => {
    const category = await app.inject({
      method: 'POST',
      url: '/api/admin/categories',
      headers: { Authorization: 'Bearer staff' },
      payload: { name: 'Test category', slug: `test-${randomUUID()}`, position: 1 },
    });
    expect(category.statusCode).toBe(201);
    const item = {
      category_id: category.json().id,
      name: `Test item ${randomUUID()}`,
      description: 'Verified staff content',
      price_paise: 12500,
      dietary: 'vegetarian',
      image_path: null,
      published: false,
      featured: false,
    };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/admin/menu',
          headers: { Authorization: 'Bearer customer' },
          payload: item,
        })
      ).statusCode,
    ).toBe(403);
    const saved = await app.inject({
      method: 'POST',
      url: '/api/admin/menu',
      headers: { Authorization: 'Bearer staff' },
      payload: item,
    });
    expect(saved.statusCode).toBe(201);
    expect(
      (await app.inject({ url: `/api/menu?q=${encodeURIComponent(item.name)}` })).json().total,
    ).toBe(0);
    const update = await app.inject({
      method: 'PUT',
      url: `/api/admin/menu/${saved.json().id}`,
      headers: { Authorization: 'Bearer staff' },
      payload: { ...item, published: true, version: 1 },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().version).toBe(2);
    expect(
      (await app.inject({ url: `/api/menu?q=${encodeURIComponent(item.name)}` })).json().items,
    ).toHaveLength(1);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/admin/menu/${saved.json().id}`,
          headers: { Authorization: 'Bearer staff' },
          payload: { ...item, version: 1 },
        })
      ).json().error.code,
    ).toBe('STALE_VERSION');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/admin/menu',
          headers: { Authorization: 'Bearer staff' },
          payload: { ...item, image_path: 'https://unsafe.example/image.svg' },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('rejects uploaded SVG disguised as a raster image before calling storage', async () => {
    const payload = Buffer.from(
      '--piccolo\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>\r\n--piccolo--\r\n',
    );
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/uploads',
      headers: {
        Authorization: 'Bearer staff',
        'Content-Type': 'multipart/form-data; boundary=piccolo',
      },
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_IMAGE');
  });
  it('denies cross-user/guessed guest access and unauthenticated staff actions', async () => {
    const r = (await create(booking(), randomUUID(), 'customer')).json().reservation;
    expect(
      (
        await app.inject({
          url: `/api/reservations/${r.id}`,
          headers: { Authorization: 'Bearer other' },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          url: `/api/reservations/${r.id}`,
          headers: { Authorization: 'Bearer customer' },
        })
      ).statusCode,
    ).toBe(200);
    expect((await app.inject({ url: '/api/admin/reservations' })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          url: '/api/admin/reservations',
          headers: { Authorization: 'Bearer customer' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: '/api/admin/reservations',
          headers: { Authorization: 'Bearer fabricated' },
        })
      ).statusCode,
    ).toBe(401);
    expect((await change(r.id, 1, 'confirmed', 'customer')).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/api/admin/users/${ids.customer}/role`,
          headers: { Authorization: 'Bearer customer' },
          payload: { role: 'admin' },
        })
      ).statusCode,
    ).toBe(403);
    const guest = (await create()).json();
    expect(
      (
        await app.inject({
          url: `/api/reservations/${guest.reservation.id}`,
          headers: { 'X-Booking-Token': 'wrong' },
        })
      ).statusCode,
    ).toBe(404);
  });
  it('protects the last admin and reads roles from database, not metadata', async () => {
    await expect(
      runtime.query('select cafe_private.set_role($1,$2,$3)', [
        ids.customer,
        ids.customer,
        'admin',
      ]),
    ).rejects.toThrow('FORBIDDEN');
    await expect(
      runtime.query('select cafe_private.set_role($1,$2,$3)', [ids.admin, ids.admin, 'customer']),
    ).rejects.toThrow('LAST_ADMIN');
  });
  it('applies customer RLS and revokes alternate write/function paths for Data API roles', async () => {
    const mine = (await create(booking(), randomUUID(), 'customer')).json().reservation;
    await create(booking(), randomUUID(), 'other');
    const functionId = (
      await owner.query(
        "select 'cafe_private.create_booking(uuid,uuid,text,text,jsonb,text,text)'::regprocedure::oid id",
      )
    ).rows[0].id;
    const c = await owner.connect();
    try {
      await c.query('begin');
      await c.query('set local role authenticated');
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [ids.customer]);
      const rows = (await c.query('select id from public.reservations')).rows;
      expect(rows).toEqual([{ id: mine.id }]);
      expect(
        (
          await c.query(
            "select has_table_privilege('authenticated','public.reservations','INSERT') ins,has_table_privilege('authenticated','public.profiles','UPDATE') upd,has_function_privilege('authenticated',$1::oid,'EXECUTE') exec",
            [functionId],
          )
        ).rows[0],
      ).toEqual({ ins: false, upd: false, exec: false });
      await c.query('rollback');
      await c.query('begin');
      await c.query('set local role anon');
      await expect(c.query('select * from public.reservations')).rejects.toMatchObject({
        code: '42501',
      });
      await c.query('rollback');
      await c.query('begin');
      await c.query('set local role service_role');
      await expect(
        c.query("insert into public.reservations(name) values('Bypass')"),
      ).rejects.toMatchObject({ code: '42501' });
      await c.query('rollback');
    } finally {
      await c.query('rollback');
      c.release();
    }
    await expect(
      runtime.query("update public.reservations set status='confirmed'"),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('database trigger prevents even an owner insert from exceeding capacity', async () => {
    await create(booking(4));
    await expect(
      owner.query(
        "insert into public.reservations(name,email,phone,starts_at,ends_at,guests) values('Owner path','a@example.test','1234567890',$1,$1::timestamptz+interval '90 minutes',1)",
        [start.toISO()],
      ),
    ).rejects.toThrow('CAPACITY_EXCEEDED');
  });
  it('shares request limits between database connections', async () => {
    const key = randomUUID();
    const outcomes = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        (i % 2 ? runtime : second).query('select cafe_private.consume_limit($1,5,60) allowed', [
          key,
        ]),
      ),
    );
    expect(outcomes.filter((r) => r.rows[0].allowed)).toHaveLength(5);
  });
});
describe('durable notifications', () => {
  it('keeps booking after delivery failure, retries successfully and does not resend acknowledged jobs', async () => {
    const r = (await create()).json().reservation;
    expect(
      await processOne(runtime, async () => {
        throw new Error('crash');
      }),
    ).toBe('retry');
    expect(
      (await owner.query('select id from public.reservations where id=$1', [r.id])).rowCount,
    ).toBe(1);
    await owner.query(
      "update cafe_private.notification_outbox set available_at=now()-interval '1 second'",
    );
    const seen: string[] = [];
    const send = async (job: { id: string }) => {
      seen.push(job.id);
      return 'provider-receipt';
    };
    expect(await processOne(runtime, send)).toBe('sent');
    expect(await processOne(runtime, send)).toBe('idle');
    expect(seen).toHaveLength(1);
  });
  it('recovers an expired lease after crash and fences stale acknowledgements', async () => {
    await create();
    const old = randomUUID();
    await owner.query(
      "update cafe_private.notification_outbox set status='processing',lease_until=now()-interval '1 minute',lease_token=$1,attempts=1,first_attempt_at=now()",
      [old],
    );
    const sent = await Promise.all([
      processOne(runtime, async () => 'receipt'),
      processOne(second, async () => 'receipt'),
    ]);
    expect(sent.sort()).toEqual(['idle', 'sent']);
    expect(
      (
        await owner.query(
          "update cafe_private.notification_outbox set status='pending' where lease_token=$1",
          [old],
        )
      ).rowCount,
    ).toBe(0);
  });
  it('stops expired provider retry windows instead of claiming exactly-once delivery forever', async () => {
    await create();
    await owner.query(
      "update cafe_private.notification_outbox set first_attempt_at=now()-interval '24 hours'",
    );
    expect(await processOne(runtime, async () => 'wrong')).toBe('idle');
    expect(
      (await owner.query('select status,last_error from cafe_private.notification_outbox')).rows[0],
    ).toEqual({ status: 'dead', last_error: 'RETRY_WINDOW_EXPIRED' });
  });
});
