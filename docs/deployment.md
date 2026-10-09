# Deploy the complete application

## Current status and accounts

The upgraded app runs locally and has not been published to verified production
URLs. Its current Supabase/database addresses point to this computer. Public
hosting needs a hosted Supabase project and access to your hosting accounts.
Sign in through the provider or CLI; do not paste passwords into chat.
Deploy branch `upgrade/supabase-reliable-reservations`; `main` currently contains
the earlier application.

| Part | Purpose | Host |
| --- | --- | --- |
| Frontend | Browser pages | Netlify/Vercel; publish `build/` |
| API | Bookings, availability, staff actions | Node/Docker web service |
| Supabase | Database, accounts, uploaded images | Hosted Supabase project |
| Worker | Processes queued booking emails | Continuous Node/Docker background service |
| Email provider | Delivers messages | Resend with a verified sender |

Review plan costs before choosing hosting. For example, Render offers free web
services that sleep when idle; its free service options do not include a
continuous background worker. A complete always-on deployment therefore needs
an appropriate worker host. See [Render free services](https://render.com/docs/free)
and [background workers](https://render.com/docs/background-workers).

## 1. Hosted Supabase

Create/select a project at [Supabase](https://supabase.com/dashboard). Use an
empty project for the first deployment. Obtain owner database connection details
from Connect. An IPv4-only host can use the shared **session pooler**, normally
port 5432; use your project's actual host. See
[Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

Preserve local `.env`. In a separate operator terminal, set `ADMIN_DATABASE_URL`
to the hosted owner connection and `DATABASE_SSL=true`. These terminal variables
override local `.env` for the commands. Use this repository's migration runner
as the migration owner for that fresh project:

```powershell
npm run db:migrate
npm run db:migrate -- --apply
```

Set `CAFE_API_PASSWORD` in that terminal to a newly generated random password
of at least 24 characters, then run `npm run db:role -- --apply`.
The runtime connection uses username `cafe_api`, or `cafe_api.PROJECT_REF` with
the shared pooler, and this new password. URL-encode password special characters.
Do not use `setup:local` or development seeds on production. For an existing
project, inspect/back up its data and follow [migration procedures](migration.md).

## 2. API hosting

Create a Docker web service from the repository's upgrade branch, repository
root, and checked-in `Dockerfile`. Its default command starts
`node dist/server/index.js`. Enter these private environment settings:

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | Hosted restricted `cafe_api` connection |
| `DATABASE_SSL` | `true` |
| `DATABASE_POOL_MAX` | Start with `5`; include worker connections in the total budget |
| `SUPABASE_URL` | Hosted project's HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Hosted public/publishable key |
| `SUPABASE_SECRET_KEY` | Hosted server secret/service key |
| `GUEST_TOKEN_SECRET` | Random secret, at least 32 characters; retain across releases |
| `RATE_LIMIT_SECRET` | Separate random secret, at least 32 characters |
| `WEB_ORIGIN` | Exact frontend HTTPS origin, without trailing slash |
| `HOST` | `0.0.0.0` |
| `PORT` | Host-provided port, otherwise `3001` |

Leave `TRUST_PROXY` empty until the host's trusted proxy addresses are known.
Keep database certificate verification enabled. Configure the health check as
`/api/health/ready` and verify HTTP 200 at the host-assigned API URL. Once the
frontend gets its real domain, update `WEB_ORIGIN` and redeploy the API.

## 3. Frontend hosting

Import the repository into Netlify or Vercel and select the upgrade branch.
Build command: `npm run build`. Output directory: `build`.
Both providers have checked-in SPA routing configuration. Set these public
build-time values:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Hosted project's HTTPS URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same project's public/publishable key |
| `VITE_API_URL` | Actual deployed API HTTPS URL ending in `/api` |

Never put server secrets in `VITE_*`. Rebuild/redeploy after changing these
variables; existing JavaScript bundles retain their old values.

## 4. Accounts and administrator

In hosted Supabase Auth URL settings, set Site URL to the frontend HTTPS origin
and allow its `/account` redirect. Keep signup confirmation enabled. Configure
production Auth email sending and test signup confirmation and password reset.
The local mail inbox is not an online email service.

Sign up and confirm your own account on the deployed site. Get its UUID from
Supabase Auth Users. In the operator terminal connected to the hosted project:

```powershell
npm run admin:bootstrap -- --user-id VERIFIED_USER_UUID
npm run admin:bootstrap -- --user-id VERIFIED_USER_UUID --apply
```

Sign in, open the staff dashboard and enter the real menu/categories. Verify an
image upload and its appearance on the public menu. Later roles use Team access.

## 5. Email worker

Create a background service using the same Docker release as the API. Override
the command with `node dist/server/worker.js`. Supply the same server settings
and add `RESEND_API_KEY` and a verified `EMAIL_FROM`. Do not supply owner
`ADMIN_DATABASE_URL` or `CAFE_API_PASSWORD` to either runtime service.

Bookings remain saved if the worker is offline, but queued emails are not sent.
The API health check does not prove the worker is running. Verify a delivery to
your own address and a sent event in the staff Notifications screen. Account
confirmation/reset delivery is configured separately in Supabase Auth.

## 6. Verify and add deployed links

- Open home/menu on desktop and mobile; refresh `/menu` directly.
- Verify API readiness and absence of browser CORS errors.
- Create a guest booking, save its private link, refresh it and cancel it.
- Test confirmed signup, login, password reset and customer bookings.
- Test staff restrictions, menu editing and image upload.
- Verify actual booking email delivery and worker event status.
- Arrange database/storage backups and review hosting plan limits.

After these live checks pass, replace README's pending deployment status with
the actual website URL, API readiness URL and verification date. Keep account
dashboard links and credentials private. See [operations](operations.md) for
proxy settings, certificates, monitoring, backups and failure handling.
