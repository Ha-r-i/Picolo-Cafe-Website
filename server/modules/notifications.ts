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
export async function processOne(
  db: Database,
  send: SendNotification,
): Promise<'idle' | 'sent' | 'retry'> {
  // The lease recovers work after a crash. Token fencing prevents a late worker
  // from acknowledging a job reclaimed by another worker.
  const lease = randomUUID();
  await db.query(`update cafe_private.notification_outbox set status='dead',last_error='RETRY_WINDOW_EXPIRED',lease_token=null,lease_until=null
    where status in ('pending','processing') and (first_attempt_at<now()-interval '23 hours' or (status='processing' and lease_until<now() and attempts>=8))`);
  const { rows } = await db.query<Job>(
    `with next as (
    select id from cafe_private.notification_outbox where attempts<8 and
    ((status='pending' and available_at<=now()) or (status='processing' and lease_until<now()))
    order by created_at,id for update skip locked limit 1)
    update cafe_private.notification_outbox o set status='processing',attempts=attempts+1,
    lease_token=$1,lease_until=now()+interval '60 seconds',first_attempt_at=coalesce(first_attempt_at,now())
    from next where o.id=next.id returning o.*`,
    [lease],
  );
  const job = rows[0];
  if (!job) return 'idle';
  try {
    const id = await send(job);
    await db.query(
      `update cafe_private.notification_outbox set status='sent',sent_at=now(),provider_id=$1,last_error=null,lease_until=null,lease_token=null where id=$2 and lease_token=$3`,
      [id, job.id, lease],
    );
    return 'sent';
  } catch {
    // Persist only safe failure codes, never provider response bodies containing PII.
    await db.query(
      `update cafe_private.notification_outbox set status=case when attempts>=8 then 'dead' else 'pending' end,
      last_error='PROVIDER_DELIVERY_FAILED',available_at=now()+make_interval(secs=>least(3600,(power(2,attempts)*15)::integer)),lease_until=null,lease_token=null where id=$1 and lease_token=$2`,
      [job.id, lease],
    );
    return 'retry';
  }
}
export function resendSender(apiKey: string, from: string): SendNotification {
  return async (job) => {
    if (!apiKey || !from) throw new Error('Email provider is not configured');
    const p = job.payload;
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
        to: [p.email],
        subject: `Piccolo reservation: ${p.status}`,
        text: `Hello ${p.name},\n\nYour reservation for ${p.guests} guest(s) is ${p.status}.\nStart: ${p.starts_at}\nEnd: ${p.ends_at}\nReference: ${p.reservation_id}\n\nUse the private booking page you saved to view the current status.`,
      }),
    });
    if (!response.ok) throw new Error('Email provider rejected request');
    const data = (await response.json()) as { id: string };
    if (!data.id) throw new Error('Missing provider receipt');
    return data.id;
  };
}
