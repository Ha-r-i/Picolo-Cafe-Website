import { randomUUID } from 'node:crypto';
import type { Database } from '../db.js';

export interface Job {
  id: string;
  reservation_id: string;
  attempts: number;
  lease_token: string;
  payload: {
    email: string;
    name: string;
    status: string;
    starts_at: string;
    ends_at: string;
    guests: number;
    reservation_id: string;
  };
}

export type SendNotification = (job: Job) => Promise<string>;

async function claimNextJob(database: Database, leaseToken: string): Promise<Job | undefined> {
  // Stop jobs outside the provider's retry window or at the attempt limit.
  await database.query(`
    update cafe_private.notification_outbox
    set status = 'dead', last_error = 'RETRY_WINDOW_EXPIRED',
        lease_token = null, lease_until = null
    where status in ('pending', 'processing')
      and (
        first_attempt_at < now() - interval '23 hours'
        or (status = 'processing' and lease_until < now() and attempts >= 8)
      )
  `);

  // Claim one row atomically. Other workers skip its lock; an expired lease
  // allows another worker to recover it after a crash.
  const result = await database.query<Job>(
    `with next_job as (
       select id from cafe_private.notification_outbox
       where attempts < 8
         and (
           (status = 'pending' and available_at <= now())
           or (status = 'processing' and lease_until < now())
         )
       order by created_at, id for update skip locked limit 1
     )
     update cafe_private.notification_outbox as job
     set status = 'processing', attempts = attempts + 1, lease_token = $1,
         lease_until = now() + interval '60 seconds',
         first_attempt_at = coalesce(first_attempt_at, now())
     from next_job
     where job.id = next_job.id
     returning job.*`,
    [leaseToken],
  );
  return result.rows[0];
}

async function markJobSent(
  database: Database,
  job: Job,
  leaseToken: string,
  receiptId: string,
): Promise<void> {
  // Matching the lease prevents an old worker from updating a reclaimed job.
  await database.query(
    `update cafe_private.notification_outbox
     set status = 'sent', sent_at = now(), provider_id = $1, last_error = null,
         lease_until = null, lease_token = null
     where id = $2 and lease_token = $3`,
    [receiptId, job.id, leaseToken],
  );
}

async function scheduleRetry(database: Database, job: Job, leaseToken: string): Promise<void> {
  // Save only a safe failure code, never a provider response containing customer data.
  await database.query(
    `update cafe_private.notification_outbox
     set status = case when attempts >= 8 then 'dead' else 'pending' end,
         last_error = 'PROVIDER_DELIVERY_FAILED',
         available_at = now() + make_interval(
           secs => least(3600, (power(2, attempts) * 15)::integer)
         ),
         lease_until = null, lease_token = null
     where id = $1 and lease_token = $2`,
    [job.id, leaseToken],
  );
}

export async function processOne(
  database: Database,
  send: SendNotification,
): Promise<'idle' | 'sent' | 'retry'> {
  const leaseToken = randomUUID();
  const job = await claimNextJob(database, leaseToken);
  if (!job) {
    return 'idle';
  }

  try {
    const receiptId = await send(job);
    await markJobSent(database, job, leaseToken, receiptId);
    return 'sent';
  } catch {
    await scheduleRetry(database, job, leaseToken);
    return 'retry';
  }
}

export function resendSender(apiKey: string, from: string): SendNotification {
  return async (job) => {
    if (!apiKey || !from) {
      throw new Error('Email provider is not configured');
    }

    const booking = job.payload;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `piccolo/${job.id}`,
      },
      body: JSON.stringify({
        from,
        to: [booking.email],
        subject: `Piccolo reservation: ${booking.status}`,
        text: `Hello ${booking.name},\n\nYour reservation for ${booking.guests} guest(s) is ${booking.status}.\nStart: ${booking.starts_at}\nEnd: ${booking.ends_at}\nReference: ${booking.reservation_id}\n\nUse the private booking page you saved to view the current status.`,
      }),
    });
    if (!response.ok) {
      throw new Error('Email provider rejected request');
    }

    const receipt = (await response.json()) as { id: string };
    if (!receipt.id) {
      throw new Error('Missing provider receipt');
    }
    return receipt.id;
  };
}
