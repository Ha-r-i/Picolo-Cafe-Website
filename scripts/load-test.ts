import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform, arch, totalmem } from 'node:os';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { localFixture } from './local-fixture.js';
import { option } from './admin-db.js';
if (!process.argv.includes('--native'))
  throw new Error(
    'Run --native for an isolated measured workload. No production target is accepted by this script.',
  );
const requests = Number(option('--requests') ?? 40),
  concurrency = Number(option('--concurrency') ?? 20);
if (
  !Number.isInteger(requests) ||
  requests < 8 ||
  requests > 500 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 50
)
  throw new Error('Requests: 8–500, concurrency: 1–50.');
const fixture = await localFixture();
const a = await fixture.api(false),
  b = await fixture.api(false);
try {
  await fixture.owner.query(
    'update cafe_private.settings set capacity=8,max_party_size=4,lead_minutes=0 where id',
  );
  const endpoints = await Promise.all([
    a.app.listen({ host: '127.0.0.1', port: 0 }),
    b.app.listen({ host: '127.0.0.1', port: 0 }),
  ]);
  const body = {
    name: 'Load Test',
    email: 'load@example.test',
    phone: '1234567890',
    starts_at: DateTime.now()
      .setZone('Asia/Kolkata')
      .plus({ days: 7 })
      .set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
      .toUTC()
      .toISO(),
    guests: 1,
    notes: '',
  };
  const results: { key: string; code: number; ms: number; body: Record<string, unknown> }[] = [];
  let next = 0;
  const began = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < requests) {
        const index = next++;
        const key = randomUUID(),
          start = performance.now();
        const response = await fetch(`${endpoints[index % 2]}/api/reservations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify(body),
        });
        results.push({
          key,
          code: response.status,
          ms: performance.now() - start,
          body: (await response.json()) as Record<string, unknown>,
        });
      }
    }),
  );
  const elapsed = performance.now() - began;
  const accepted = results.filter((r) => r.code === 201),
    conflicts = results.filter((r) => r.code === 409);
  const unexpected = results.filter((r) => ![201, 409].includes(r.code));
  const seats = (
    await fixture.owner.query(
      'select coalesce(sum(guests),0)::integer seats from public.reservations',
    )
  ).rows[0].seats;
  const first = accepted[0];
  const replay = await fetch(`${endpoints[1]}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': first.key },
    body: JSON.stringify(body),
  });
  const replayBody = (await replay.json()) as { reservation: { id: string } };
  const firstBody = first.body as { reservation: { id: string }; guest_token: string };
  const mismatch = await fetch(`${endpoints[0]}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': first.key },
    body: JSON.stringify({ ...body, guests: 2 }),
  });
  const cancel = await fetch(
    `${endpoints[0]}/api/reservations/${firstBody.reservation.id}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Booking-Token': firstBody.guest_token },
      body: JSON.stringify({ version: 1, status: 'cancelled' }),
    },
  );
  const replacement = await fetch(`${endpoints[1]}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
    body: JSON.stringify(body),
  });
  const times = results.map((r) => r.ms).sort((x, y) => x - y);
  const percentile = (p: number) =>
    Number(times[Math.min(times.length - 1, Math.ceil(times.length * p) - 1)].toFixed(2));
  const correct =
    accepted.length === 8 &&
    conflicts.length === requests - 8 &&
    seats === 8 &&
    unexpected.length === 0 &&
    replay.status === 200 &&
    replayBody.reservation.id === firstBody.reservation.id &&
    mismatch.status === 409 &&
    cancel.status === 200 &&
    replacement.status === 201;
  const report = {
    measured_at: new Date().toISOString(),
    environment: {
      os: platform(),
      architecture: arch(),
      cpu: cpus()[0]?.model,
      logical_cpus: cpus().length,
      memory_gib: Math.round(totalmem() / 1024 ** 3),
      node: process.version,
      postgres: (await fixture.owner.query('select version()')).rows[0].version,
      api_instances: 2,
      pool_per_instance: 10,
    },
    workload: {
      requests,
      concurrency,
      method: 'HTTP on localhost; same 90-minute interval; one guest per request; capacity 8',
      auth: 'guest only',
      limits: 'disabled only in isolated test harness',
      email: 'worker not measured',
    },
    elapsed_ms: Number(elapsed.toFixed(2)),
    latency_ms: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
    http: {
      created: accepted.length,
      expected_capacity_conflicts: conflicts.length,
      unexpected_errors: unexpected.length,
    },
    correctness: {
      passed: correct,
      allocated_seats: seats,
      replay: replay.status,
      mismatch: mismatch.status,
      cancel: cancel.status,
      replacement: replacement.status,
    },
    limits:
      'Short local contention experiment. Does not establish production traffic capacity, sustained throughput, auth latency or Supabase network latency.',
  };
  await mkdir('docs/verification', { recursive: true });
  await writeFile('docs/verification/load-native.json', JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!correct) process.exitCode = 1;
} finally {
  await a.app.close();
  await b.app.close();
  await a.pool.end();
  await b.pool.end();
  await fixture.owner.end();
  await fixture.native.stop();
}
