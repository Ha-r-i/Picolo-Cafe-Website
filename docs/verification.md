# Verification report

Workspace verification on 8 October 2026 (Asia/Kolkata), Windows x64, Node v24.12.0. This report covers local evidence; it is not a statement that production was migrated or deployed.

## Current evidence

- TypeScript checks, ESLint and the production React/server build passed after the final dependency and form updates.
- Six unit tests passed: timezone/closing boundaries, invalid/closed/past/horizon dates, normalized input, private token reproducibility, safe errors and legacy parsing.
- Twenty-two database integration tests passed against a fresh native PostgreSQL 18.4 cluster, including import dry-run/rerun/source-drift checks, menu publishing authorization and disguised SVG rejection.
- Fresh SQL migration validation rolled back cleanly; applying migrations and rerunning the migration runner succeeded. Seed reruns retained six labelled samples.
- Twenty concurrent attempts across two independent Fastify instances/pools for the last seat produced exactly one success. Overlap/adjacency, duplicate-key races, changed key body/actor, cancellation capacity release, state/time/version rules, guest and cross-user access, role escalation, RLS/grants/service-role write bypass, durable limits, notification retry/lease recovery and bounded retry horizons passed.
- Six Chromium browser tests passed across desktop and mobile: menu filters/search/empty state, real-database guest confirmation/cancellation, navigation and staff-access gating. The complete suite passed again after the final form and Windows fixture-cleanup changes, with no temporary PostgreSQL processes remaining. Generated screenshots were visually reviewed; the original cafe photo and wordmark remain, with responsive cream/green typography and layouts. Screenshots are recreated under ignored `docs/verification` by the browser tests and retained as GitHub Actions artifacts.
- Production dependency audit identified older router/image-library advisories during implementation; React Router 7.18.4 and sharp 0.35.5 were installed, and `npm audit --omit=dev` now reports zero vulnerabilities. This is advisory-registry evidence, not a guarantee that software has no undiscovered flaws.

## Measured local contention workload

The load command writes a fresh machine-readable report to ignored `docs/verification/load-native.json`; CI also retains it as a verification artifact. Command:

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

## Readability refactor: 9 October 2026

Server startup and app setup now use named steps; booking helpers live in `server/modules/booking-rules.ts`, common validation in `server/validation.ts`, and routes use readable parameterized SQL. The staff screen delegates its tools to separate components under `src/app/staff`. Account actions use a switch and the booking form uses a named retry-key helper. Versioned SQL migrations and the database guarantees were not changed.

Type checks, lint, production build, eight unit tests, 23 native PostgreSQL integration tests and six Chromium desktop/mobile tests passed. New regression coverage includes malformed error values, dashboard visit/notification totals and successful guest booking with a corrupt saved retry entry. The original booking concurrency, authorization, capacity, idempotency and worker-recovery checks still passed.

The normal browser command found an existing development server on port 3000. The same suite then ran with temporary local configuration on ports 43100/43101 against its own database and API. The existing development server was not stopped and the normal project port configuration was not changed. Temporary test configuration, reports, exports, stopped test databases and build outputs were removed after verification. Local environment-file edits were preserved and excluded from the refactor commit.

These browser tests cover guest flows and access gating, not real Supabase Auth/Storage HTTP. The separate CI security job and staging acceptance checks retain the scope described above. Start with [the junior developer walkthrough](junior-guide.md) for the refactored code structure.

## Beginner setup repair: 9 October 2026

The reported startup failure came from settings being placed in `.env.example` while `.env`
contained no parseable environment settings. The API could not start, so the existing Vite
server reported proxy connection failures on port 3001. Local Supabase was also absent.
Both original environment files were preserved in ignored `.local-backup`; the usable local
settings were moved to `.env` and the example restored to its shareable template.

Supabase CLI 2.120.0 is now pinned as a development dependency. `supabase:start`,
`supabase:stop`, `setup:local` and `doctor` provide a guided local workflow. The setup
command captures local keys privately, backs up `.env`, generates missing secrets and
provisions the restricted login. A separate guard check verified that a hosted database
URL is rejected before writing configuration or connecting, without printing its password.
Repeated setup preserved the runtime password and both HMAC secrets.
`predev` checks configuration before launching frontend/API processes.

On this Windows machine, Docker 29.6.1 started the real local Supabase stack successfully.
All three existing migrations and the development seed applied. `setup:local` completed;
`doctor` passed configuration, PostgreSQL/runtime-role/settings and Auth public-key checks.
The actual API started on port 3001. Requests through the existing frontend proxy on port
3000 returned HTTP 200 for readiness, menu (six seed items) and cafe settings.

`npm run test:security` passed against this actual Windows local Supabase instance: real
Auth/password sign-in, server token verification, customer isolation, metadata escalation
rejection, staff authorization, Data API/RPC/service-key bypass denial and direct customer
Storage upload denial. This resolves the earlier Windows infrastructure limit for those
checks. Full browser signup/confirmation/reset, successful staff image upload and provider
email delivery retain the acceptance scope described above.

Type checks, lint, production build and all 11 unit tests passed, including three new
configuration regression tests. The new [beginner guide](beginner-guide.md) was rendered
to a searchable 13-page [PDF](Piccolo-Cafe-Beginner-Guide.pdf) with 15 chapter bookmarks
and two diagrams. Every page was visually reviewed; the final audit reported zero text
boundary or replacement-glyph problems. PDF dependencies/renders and temporary build
outputs are excluded from Git. No application SQL migrations or production deployments
were changed by this repair.
