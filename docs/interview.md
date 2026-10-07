# Interview explanation and demo

## Explain the code, not hypothetical scale

| Interview topic | Code to open | What it demonstrates |
| --- | --- | --- |
| Framework decision | `vite.config.ts`, `src/app/main.tsx`, `server/app.ts` | Retained React; upgraded build tooling; added one modular API rather than a framework rewrite |
| Booking invariants | `server/modules/reservations.ts`, `supabase/migrations/202610080001_core.sql` | Zod input validation, normalized time, database constraints and capacity trigger |
| Concurrent last seat | `create_booking`, `guard_capacity`, `peak_seats`, `tests/integration/database.test.ts` | Database row lock shared across instances; peak occupancy and half-open intervals |
| Retry safety | Client Booking submit, `booking_requests`, fingerprint and rate budgets | UUID per payload, transactionally saved response, changed-key rejection, retries consume budget once |
| Authorization | `server/modules/auth.ts`, `set_role`, RLS/grants | Server getUser verification, DB-owned roles, customer isolation and denied bypass writes |
| Staff changes | `change_booking`, `shared/types.ts`, staff reservation controls | State machine, optimistic version and append-only operational history |
| Notifications | `record_reservation`, `server/modules/notifications.ts` | Transactional outbox, leases, SKIP LOCKED, fencing, backoff and finite provider deduplication |
| Uploaded files | `server/modules/menu.ts`, storage migration | Staff checks, byte/pixel limits, decoded WebP, immutable public object paths |
| Data migration | `scripts/import-legacy.ts`, user/file importers | Dry runs, relationships/timestamps, safe reruns, changed-source detection, separate password resets |
| Measurement | `scripts/load-test.ts`, recorded JSON | Two localhost API instances, actual conflicts/seats, p50/p95/p99 and honest exclusions |

Suggested explanation: “The original site let the browser insert bookings directly. I moved writes behind verified API permissions and atomic PostgreSQL functions. The availability list helps the customer choose, but only the database transaction decides whether seats are allocated. Pending bookings count toward capacity, duplicates replay one saved result, and notifications are queued in the same commit.”

Be ready to explain why total intersecting guests is not the same as peak simultaneous occupancy. Example: a 12:00–13:30 party and a 13:30–15:00 party both intersect a 12:30–14:00 visit, yet those original parties never overlap each other. Explain why an in-memory lock would fail with two API instances, why privilege grants matter alongside RLS, and why a service-role key must never be treated as a permission check.

Discuss trade-offs: one cafe lock is simple and limits throughput; a seat-based model does not assign actual tables; pending bookings do not expire automatically; a SPA session is exposed to XSS; exactly-once external delivery cannot be guaranteed beyond provider deduplication; an email/account migration is not equivalent to migrating sessions/passwords. Proposed infrastructure should address an observed limit rather than an imagined user count.

## Five-minute demonstration

1. Open the full configured local Supabase application. Browse menu categories/search and explain that sample data is labelled. Show a mobile viewport and keyboard focus/navigation. Do not describe seed prices as the real cafe menu.
2. Book as a guest for a returned future slot. Show pending confirmation, private link, current status and cancellation. Show the newly inserted reservation, audit entry and outbox row in local Studio. Cancellation makes capacity available again.
3. Run `npm run test:embedded`. Point at the last-seat test: one existing three-person party, capacity four, twenty simultaneous one-person attempts across two instances, exactly one success. This is an automated reproducible proof, not a staged UI counter.
4. Show the concurrent duplicate test and rate-budget replay test: same key/body yields one reservation and one notification; changed details with the same key fail. Explain that the stored response is the creation result and the management page gets current state.
5. Sign in with a bootstrapped staff/admin account. Filter reservations, confirm one, display audit history, and demonstrate stale version rejection with the integration test. Edit/publish a menu item and upload an allowed image through the API. Show actual queue/metric counts. Account/Storage/provider behavior needs a real Supabase stack; the credential-free guest fixture does not provide those services.

If a verified email provider is available, run the worker and show the sent receipt. Otherwise show queued events and the worker-recovery test without claiming an email arrived. Finish by opening the local load report: give its workload/environment/latency and explicitly say it does not establish production traffic capacity.

## Reproduce evidence before an interview

```powershell
npm run typecheck
npm run lint
npm test
npm run test:embedded
npm run build
npm run test:e2e
npm run load -- --native --requests 40 --concurrency 20
# With a running, configured LOCAL Supabase stack:
npm run test:security
```

Read the verification report and explain blocked infrastructure checks honestly. CI configuration is checked in but a new remote CI run is not evidence until it executes on the pushed branch. Publishing the upgrade branch does not merge it into main or establish a production deployment. For a guided Windows setup and code tour, use [the project handbook](Piccolo-Cafe-Run-and-Understand.pdf).
