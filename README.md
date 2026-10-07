# Piccolo Cafe

A React and TypeScript cafe application with a Fastify API, Supabase Auth and Storage, and PostgreSQL-enforced reservations. The project starts as a modular monolith: one API deployment, one notification worker, one Supabase project.

The upgrade branch is `upgrade/supabase-reliable-reservations`. No production data was migrated, no live deployment was changed, and the nested Git checkout was left untouched. Original UI edits and Firebase configuration are preserved in [migration/legacy](migration/legacy/README.md), with an additional ignored `.local-backup` snapshot.

## What is implemented

- Published menu browsing, category/search/dietary filters and pagination; clearly labelled development samples.
- Guest and account reservations, live availability, private guest access, confirmation and cancellation.
- Capacity checks across overlapping visits, a database lock shared across instances, atomic idempotency, authorized state transitions, optimistic versions and audit history.
- Supabase email/password accounts, signup confirmation, password reset, server-verified sessions and customer/staff/admin roles.
- Staff reservation search/status management, menu/category editing, restricted image uploads, real database metrics and notification failure visibility.
- Durable transactional outbox, leased worker retries, fenced acknowledgements and provider idempotency.
- SQL migrations, development seed, import/export utilities, CI, unit/database/browser tests and a measured local load script.

There is no MongoDB in the inspected application. Firebase, Cloudinary and EmailJS are no longer runtime integrations. React remains the framework; Vite replaces the older Create React App build tooling so new client and server code can use current TypeScript tooling.

## Requirements

Node.js 22.12 or later (verified on Node 24), npm, and Docker Desktop for the complete local Supabase stack. The native PostgreSQL tests and guest browser tests work without Docker. Native tests provide test-only Auth/Storage SQL shapes; they do **not** pretend to run Supabase Auth, Storage HTTP or PostgREST.

## Full local application

1. Start Docker Desktop. Install dependencies and start a fresh local Supabase project:

   ```powershell
   npm ci
   npx supabase start
   npx supabase status
   ```

   Supabase CLI applies `supabase/migrations` and the development seed to a fresh local stack. Use `localhost:3000` consistently for Auth redirects. Configure real email sending for staging; local emails are inspected in Supabase's local mail UI.

2. Copy `.env.example` to `.env` **only after preserving your existing `.env`**. Fill the public/secret keys from `supabase status`. Browser values are exclusively `VITE_*`. Keep `DATABASE_URL`, `ADMIN_DATABASE_URL`, the Supabase secret and HMAC secrets on the server.

3. Provision the restricted runtime login. Generate its password and both HMAC secrets using a cryptographic random generator, then set the same password in `DATABASE_URL`:

   ```powershell
   $env:CAFE_API_PASSWORD = 'YOUR_RANDOM_PASSWORD_AT_LEAST_24_CHARACTERS'
   npm run db:role -- --apply
   npm run dev
   ```

   Frontend: <http://localhost:3000>; API health: <http://127.0.0.1:3001/api/health/ready>. `npm start` starts only the frontend; `npm run dev:api` starts only the API. The API refuses an owner/superuser database URL.

4. Sign up at `/account`, confirm the email, and obtain that user's UUID from local Supabase Studio. Bootstrap the **first** administrator using the operator database connection:

   ```powershell
   npm run admin:bootstrap -- --user-id VERIFIED_USER_UUID
   npm run admin:bootstrap -- --user-id VERIFIED_USER_UUID --apply
   ```

   Bootstrap refuses unconfirmed users and a second bootstrap. Later role changes use the authenticated administrator's Team access screen. User metadata never controls roles.

5. To send reservation emails, configure `RESEND_API_KEY` and a verified `EMAIL_FROM`, then start the worker separately:

   ```powershell
   npm run worker
   ```

   Missing email credentials do not undo bookings. The worker refuses to claim jobs until configured. The staff Notifications screen shows queued, processing, sent and failed events.

## Checks without Supabase credentials

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:embedded
npx playwright install chromium
npm run test:e2e
npm run load -- --native --requests 40 --concurrency 20
```

`test:embedded` creates a fresh, isolated native PostgreSQL database and tests two API instances. `test:e2e` launches its own isolated database, guest API and Vite server on ports 3001/3000; stop your normal development servers first. It verifies desktop and mobile guest workflows and collects screenshots. Test clusters remain under ignored `.local-db`; no production target is accepted by the load script. Some restricted Windows environments need permission for the bundler or PostgreSQL subprocesses.

After starting real local Supabase, set the `TEST_SUPABASE_*` variables to its URL/public key/secret key, and keep the operator/runtime DB URLs pointed at that same local instance:

```powershell
npm run test:security
```

This script uses actual Supabase Auth, Data API and Storage HTTP requests. It fails with an explicit blocked message when the infrastructure is absent. The CI security job provisions the real local Supabase stack.

For an existing isolated database whose name contains `test`, use `TEST_DATABASE_URL` and `npm run test:db`. It needs the Supabase Auth/Storage schemas or the test bootstrap fixture on a brand-new plain PostgreSQL cluster. Never run the bootstrap fixture inside a real Supabase project.

## Migrations and imports

For an empty hosted staging database, the operator runner validates SQL in a rolled-back transaction and tracks checksums on application:

```powershell
npm run db:migrate
npm run db:migrate -- --apply
npm run db:seed
npm run db:seed -- --apply
```

Use **one** migration owner: Supabase CLI or this runner. Do not apply the same migrations through both on the same project. Seeds are development samples; do not seed production. Both runners stop on validation failures. Existing data must be exported and imported separately using the procedures in [Migration and rollback](docs/migration.md).

## Documentation

Start with the [20-page run-and-understand PDF](docs/Piccolo-Cafe-Run-and-Understand.pdf),
or its [editable Markdown guide](docs/run-and-understand.md), for Windows setup,
configuration, a guided code tour, workflow diagrams, troubleshooting and interview practice.

| Document | What it explains |
| --- | --- |
| [Inspection and architecture](docs/architecture.md) | Actual repository findings, boundaries and diagrams |
| [System design](docs/system-design.md) | Transactions, capacity, retries, permissions and scaling |
| [API](docs/api.md) | Routes, authentication, payloads and safe errors |
| [Migration and rollback](docs/migration.md) | Export/import, users, files, staging and cutover |
| [Operations and deployment](docs/operations.md) | Environment, configuration, worker and hosting |
| [Interview and demo guide](docs/interview.md) | Code paths, engineering explanations and walkthrough |
| [Verification](docs/verification.md) | Passed checks, infrastructure limits and measured workload |

Production deploys the static `build/` frontend and the API/worker separately. Netlify/Vercel configurations serve the frontend only. See operations for the API container and compiled worker command. No new caching infrastructure, payments, delivery, invented reviews or business metrics were added.
