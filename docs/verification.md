# Verification report

Workspace verification on 8 October 2026 (Asia/Kolkata), Windows x64, Node v24.12.0. This report covers local evidence; it is not a statement that production was migrated or deployed.

## Current evidence

- TypeScript checks, ESLint and the production React/server build passed after the final dependency and form updates.
- Six unit tests passed: timezone/closing boundaries, invalid/closed/past/horizon dates, normalized input, private token reproducibility, safe errors and legacy parsing.
- Twenty-two database integration tests passed against a fresh native PostgreSQL 18.4 cluster, including import dry-run/rerun/source-drift checks, menu publishing authorization and disguised SVG rejection.
- Fresh SQL migration validation rolled back cleanly; applying migrations and rerunning the migration runner succeeded. Seed reruns retained six labelled samples.
- Twenty concurrent attempts across two independent Fastify instances/pools for the last seat produced exactly one success. Overlap/adjacency, duplicate-key races, changed key body/actor, cancellation capacity release, state/time/version rules, guest and cross-user access, role escalation, RLS/grants/service-role write bypass, durable limits, notification retry/lease recovery and bounded retry horizons passed.
- Six Chromium browser tests passed across desktop and mobile: menu filters/search/empty state, real-database guest confirmation/cancellation, navigation and staff-access gating. The complete suite passed again after the final form and Windows fixture-cleanup changes, with no temporary PostgreSQL processes remaining. Screenshots in `docs/verification` were visually reviewed; the original cafe photo and wordmark remain, with responsive cream/green typography and layouts.
- Production dependency audit identified older router/image-library advisories during implementation; React Router 7.18.4 and sharp 0.35.5 were installed, and `npm audit --omit=dev` now reports zero vulnerabilities. This is advisory-registry evidence, not a guarantee that software has no undiscovered flaws.

## Measured local contention workload

See [machine-readable report](verification/load-native.json). Command:

```powershell
npm run load -- --native --requests 40 --concurrency 20
```

Recorded environment: Windows x64, AMD Ryzen 9 5980HX, 16 logical CPUs, approximately 15 GiB RAM, Node v24.12.0, native PostgreSQL 18.4. Two HTTP API processes on localhost, ten pool connections each, one 90-minute candidate interval, one guest per request, seat capacity eight. Guest-only workload; test harness disables rate budgets to isolate contention. Auth, real Supabase network latency and email worker throughput were not measured.

The recorded 40-request run completed in about 911 ms. Latency was p50 371 ms, p95 617 ms, p99 663 ms. Eight bookings succeeded, 32 returned expected capacity conflicts, and zero returned unexpected errors. Stored seat allocation was eight. Replay returned 200 for the same result; changed details returned 409; cancellation returned 200 and a replacement booking returned 201. This is a short correctness experiment, not a sustained load/production traffic-capacity claim.

## Infrastructure-dependent checks

Real Supabase Auth login/reset, Storage upload/download and PostgREST bypass tests need a running local Supabase stack plus `TEST_SUPABASE_URL`, `TEST_SUPABASE_PUBLISHABLE_KEY`, `TEST_SUPABASE_SECRET_KEY` and matching operator/runtime DB URLs. `npm run test:security` was attempted and explicitly blocked by missing credentials. Docker Desktop's daemon was not running in the workspace. Native tests used actual PostgreSQL with test-only Auth/Storage **schema shapes** and injected test identity verification; those are not evidence that Supabase HTTP integrations ran.

Real notification-provider acceptance/domain delivery requires `RESEND_API_KEY` and verified `EMAIL_FROM`; neither was available. Worker retry/crash handling was tested with injected send failures/receipts and real durable SQL state. No email was sent. At the time of local application verification, remote CI had not run; the workflow defines both application checks and a real local Supabase security job. Consult GitHub Actions after branch publication for its actual status.

The follow-up project handbook was rendered directly to a searchable 20-page PDF with 22 navigation bookmarks and four diagrams. Every page image was visually reviewed, and its text-boundary audit reported zero layout problems. Its setup instructions are based on the actual scripts/configuration; real-stack startup remains subject to the infrastructure limits above.

## Subsequent GitHub verification

[GitHub Actions run 37694825467](https://github.com/Ha-r-i/Picolo-Cafe-Website/actions/runs/37694825467) completed successfully for commit `a796aab8c9e87f8509e00be768bfcd87cd5c6a25`, with both `application` and `supabase-security` jobs passing on Ubuntu. The application job ran type checks, lint, unit/build/native database tests, Chromium desktop/mobile tests and the isolated load script. The security job started an actual local Supabase stack, provisioned the restricted runtime role, and passed real Auth account creation/password sign-in/server verification, customer isolation, user-metadata escalation rejection, direct Data API mutation/RPC/service-key bypass denial, customer staff denial, invalid-token rejection and direct customer Storage upload denial.

This resolves the earlier infrastructure block for those checks in CI, not on this Windows machine. The suite does not exercise the complete signup-confirmation/password-reset browser journey, successful staff image upload/public download or real notification delivery. Those remain staging acceptance checks. The exact handbook PowerShell guest-booking/retry commands were additionally executed against an isolated native database; both same-ID and replay checks returned True, and fixture cleanup completed.

The in-app browser automation tool failed before opening a page due to an environment metadata error. The project Playwright suite is used for independent automated Chromium desktop/mobile verification and screenshots. Initial attempts hit sandbox PostgreSQL/bundler restrictions and a missing Chromium binary; the required subprocess access and browser installation were subsequently provided.
