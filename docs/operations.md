# Operations and deployment

Start with the [step-by-step deployment walkthrough](deployment.md) for hosted setup.

## Environment and secret boundaries

`.env.example` is the complete reference. Preserve the existing developer `.env` before replacing it; its Cloudinary entries are unused by the new app. Vite exposes only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_API_URL`. The API receives Supabase URL/public/secret keys, the restricted `DATABASE_URL`, stable HMAC secrets, CORS origin, proxy trust, pool sizing and log level. Only operator scripts receive `ADMIN_DATABASE_URL` or `CAFE_API_PASSWORD`. Do not set either in the API/worker host's environment.

In production use HTTPS for frontend/API/Supabase, `DATABASE_SSL=true` for the database with verified certificates, `HOST=0.0.0.0`, and an exact `WEB_ORIGIN`. `TRUST_PROXY` is an explicit comma-separated list of trusted proxy IP/CIDR addresses, not a blanket true. Set the same guest/rate secrets across instances. Changing the guest secret makes creation-response token replay incompatible with old hashes; retain it during rollback and plan a versioned secret rotation before rotating. Supabase refresh sessions depend on the project's Auth configuration, not on this service's in-memory state.

Use a direct PostgreSQL connection as `cafe_api`, with Supabase's project connection details and region. The runtime validates the actual PostgreSQL role at startup. Provision the role using an operator-only connection; passwords must be at least 24 random characters. Review network restrictions and total connection budget before increasing process counts. The checked-in shared database contracts are maintained in `shared/types.ts`; update them with migrations and type checking. If adding Data API queries, generate Supabase types for the public schema instead of inventing an incompatible SDK shape.

## Configuration

Cafe settings live in the private singleton table. An operator changes them transactionally with the settings row lock; normal booking functions lock the same row. Example after confirming actual policy:

```sql
begin;
select * from cafe_private.settings where id for update;
update cafe_private.settings
set capacity = 24, max_party_size = 10, duration_minutes = 90,
    slot_minutes = 30, lead_minutes = 120, cancellation_minutes = 120,
    timezone = 'Asia/Kolkata', horizon_days = 60
where id;
commit;
```

Opening-hours JSON must have keys `0` through `6` (Sunday through Saturday). Each value is null for a closed day or `{ "open":"09:00", "close":"22:00" }`. Times must be valid, ordered in one day and aligned to the slot interval. Capacity cannot be reduced below existing peak active bookings. Duration changes affect newly created visits; existing `ends_at` remains the recorded interval. Changes to hours/timezone apply to future bookings; review existing reservations separately rather than silently moving them.

## Deployment units

Build with `npm ci`, `npm run typecheck`, `npm run lint`, tests and `npm run build`. Publish `build/` to the existing static host, Netlify or Vercel with SPA fallback; set Vite's API/public keys at build time. Updated Netlify/Vercel configurations include basic response security headers and do not imply an API deployment. Apply a deployment-specific CSP allowing only the intended Supabase/API origins and font/image sources. The UI uses Google Fonts with system fallbacks and optimized local WebP assets; self-host fonts if external font requests are undesirable.

Run API: `node dist/server/index.js`. Run worker from the same compiled release: `node dist/server/worker.js`. The Dockerfile builds a server image with a non-root runtime user. Override the command for a worker container and supply only server/runtime secrets. Docker build excludes exports, `.env`, nested checkout and snapshots. Native test binaries are development dependencies and are pruned from runtime. The container does not host the frontend; build the static frontend in its own deployment with its public build-time variables.

Apply SQL through a single migration owner before starting the new API. The operator runner defaults to validation/rollback, requires `--apply` for persistence, uses a migration advisory lock and tracks checksums. Supabase CLI local startup applies migrations automatically to a fresh stack; don't then replay them with the independent runner. Supabase secret/service keys are used for Auth administration in operator utilities and staff-authorized Storage uploads, never direct booking writes.

## Monitoring and failure handling

Liveness `/api/health/live` verifies the process. Readiness `/api/health/ready` executes a bounded database query; failed DB connections make it 503. Configure host supervision/restarts for API and worker. Structured request logs carry UUID request IDs, method/path and safe failure codes, not bodies/tokens/customer email. Request IDs are returned to clients. Keep log access/retention appropriate to staff data.

Watch pending reservation age, settings lock waits, API 503s, pool utilization, and outbox pending/processing/dead counts. The staff dashboard displays database counts and notification event status/attempts. A worker with missing provider keys refuses to start and leaves queued rows intact. Failures use safe codes such as `PROVIDER_DELIVERY_FAILED` or `RETRY_WINDOW_EXPIRED`; correlate event UUID with provider receipts for investigation. A configured worker regularly removes stale rate-limit windows. If it remains disabled, schedule equivalent operator cleanup of rate budgets.

Outbox retry is at least once with finite provider deduplication. Do not clear a dead flag and blindly send after the provider window. Check whether the event was accepted, verify recipient/current reservation state, then either mark a verified receipt or issue a reviewed new notification event. Automatically restarting the worker is safe inside the lease/retry window. Email delivery order across workers is not guaranteed. No staff-control button claims to fix ambiguous delivery.

Database backups must include private schemas, idempotency requests, audit and queue receipts, not just public tables. Retain storage originals during migration and back up Supabase object metadata/content according to the project's backup policy. Restore into staging and rehearse both guest-token access and staff account resets. Retention/anonymization of personal details is an operator policy not implemented as an automatic destructive job. Deleting an Auth account detaches ownership but does not automatically anonymize reservation PII.

## Limits and next steps

This implementation has no automated certificate/domain setup, live production migration, hosted Supabase/provider verification, table layout assignment, rescheduling, overnight hours, multi-venue capacity or automatic pending-booking expiry. Email requires a verified provider/domain. Admin MFA and production CSP/edge abuse protection are deployment configuration tasks. Substring search remains simple; large history needs measured indexing/retention improvements. No production capacity number is claimed. See the measured local workload and its exclusions in verification.
