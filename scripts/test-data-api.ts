import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import { adminPool } from './admin-db.js';
import { buildApp } from '../server/app.js';
import { makePool } from '../server/db.js';
import { readConfig } from '../server/config.js';
const url = process.env.TEST_SUPABASE_URL,
  publicKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.TEST_SUPABASE_SECRET_KEY;
if (!url || !publicKey || !secret)
  throw new Error(
    'BLOCKED: set TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY and TEST_SUPABASE_SECRET_KEY from a running LOCAL Supabase instance. This is a real HTTP security test; no mock fallback.',
  );
const local = (value: string) =>
  ['localhost', '127.0.0.1', '::1'].includes(new URL(value).hostname);
if (!local(url) || !process.env.ADMIN_DATABASE_URL || !local(process.env.ADMIN_DATABASE_URL))
  throw new Error(
    'This test creates and removes only its own records, and is restricted to local Supabase.',
  );
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const owner = adminPool();
const createdUsers: string[] = [];
const createdReservations: string[] = [];
const config = {
  ...readConfig(),
  SUPABASE_URL: url,
  SUPABASE_PUBLISHABLE_KEY: publicKey,
  SUPABASE_SECRET_KEY: secret,
};
const runtime = makePool(config);
const app = await buildApp(config, runtime, { logger: false });
async function direct(
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string,
  key = publicKey!,
) {
  return fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
try {
  const accounts: { id: string; token: string }[] = [];
  for (let i = 0; i < 2; i++) {
    const email = `piccolo-security-${randomUUID()}@example.test`,
      password = randomBytes(24).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' },
    });
    if (error || !data.user) throw new Error('Supabase Auth test user creation failed.');
    createdUsers.push(data.user.id);
    const browser: SupabaseClient = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await browser.auth.signInWithPassword({ email, password });
    assert.equal(signed.error, null);
    assert.ok(signed.data.session);
    accounts.push({ id: data.user.id, token: signed.data.session!.access_token });
  }
  for (const account of accounts) {
    const row = (await owner.query('select role from public.profiles where id=$1', [account.id]))
      .rows[0];
    assert.equal(row.role, 'customer', 'Untrusted metadata cannot grant admin');
    const starts = DateTime.now()
      .setZone('Asia/Kolkata')
      .plus({ days: 7 })
      .set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
      .toUTC()
      .toISO();
    const data = {
      name: 'Security Test',
      email: 'security@example.test',
      phone: '1234567890',
      starts_at: starts,
      guests: 1,
      notes: '',
    };
    const result = await app.inject({
      method: 'POST',
      url: '/api/reservations',
      headers: { Authorization: `Bearer ${account.token}`, 'Idempotency-Key': randomUUID() },
      payload: data,
    });
    assert.equal(result.statusCode, 201);
    createdReservations.push(result.json().reservation.id);
  }
  const anonymous = await direct('reservations?select=id');
  assert.equal(anonymous.ok, false, 'Anonymous reservation reads must fail');
  const own = await direct(
    `reservations?id=eq.${createdReservations[0]}&select=id`,
    'GET',
    undefined,
    accounts[0].token,
  );
  assert.equal(own.ok, true);
  assert.equal(((await own.json()) as unknown[]).length, 1);
  const other = await direct(
    `reservations?id=eq.${createdReservations[1]}&select=id`,
    'GET',
    undefined,
    accounts[0].token,
  );
  assert.deepEqual(await other.json(), []);
  for (const [path, method, body] of [
    ['reservations', 'POST', { name: 'Bypass' }],
    ['reservations', 'PATCH', { status: 'confirmed' }],
    ['profiles', 'PATCH', { role: 'admin' }],
    ['menu_items', 'POST', { name: 'Unauthorized' }],
  ] as const) {
    const response = await direct(path, method, body, accounts[0].token);
    assert.equal(response.ok, false, `Direct ${path} ${method} must be denied`);
  }
  const rpc = await direct('rpc/create_booking', 'POST', {}, accounts[0].token);
  assert.equal(rpc.ok, false);
  const serviceInsert = await direct(
    'reservations',
    'POST',
    { name: 'Service bypass' },
    undefined,
    secret,
  );
  assert.equal(serviceInsert.ok, false, 'Service key cannot bypass revoked booking table grants');
  const staff = await app.inject({
    url: '/api/admin/reservations',
    headers: { Authorization: `Bearer ${accounts[0].token}` },
  });
  assert.equal(staff.statusCode, 403);
  const invalid = await app.inject({
    url: '/api/me',
    headers: { Authorization: 'Bearer fabricated.jwt.token' },
  });
  assert.equal(invalid.statusCode, 401);
  const object = `menu/security/${randomUUID()}.webp`;
  const upload = await fetch(`${url}/storage/v1/object/menu-images/${object}`, {
    method: 'POST',
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${accounts[0].token}`,
      'Content-Type': 'image/webp',
    },
    body: new Uint8Array([82, 73, 70, 70]),
  });
  assert.equal(upload.ok, false, 'Direct customer storage upload must be denied');
  process.stdout.write(
    'PASS: real Supabase Auth, customer isolation, metadata escalation, Data API writes/RPC, service-key bypass, staff authorization and Storage upload denial.\n',
  );
} finally {
  // Exact IDs created by this test only; no truncate or broad data deletion.
  if (createdReservations.length) {
    await owner.query(
      'delete from cafe_private.notification_outbox where reservation_id=any($1::uuid[])',
      [createdReservations],
    );
    await owner.query(
      'delete from cafe_private.booking_requests where reservation_id=any($1::uuid[])',
      [createdReservations],
    );
    await owner.query('delete from public.reservation_audit where reservation_id=any($1::uuid[])', [
      createdReservations,
    ]);
    await owner.query('delete from public.reservations where id=any($1::uuid[])', [
      createdReservations,
    ]);
  }
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  await app.close();
  await runtime.end();
  await owner.end();
}
