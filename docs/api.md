# API reference

All routes use `/api`, JSON unless noted, and `Cache-Control: no-store`. Every response carries `X-Request-Id`. Private lists default to `page=1&pageSize=20`, with a maximum of 100 items and a maximum page of 10,000. List bodies are `{ "items": [], "page": 1, "pageSize": 20, "total": 0 }`.

Signed-in requests use `Authorization: Bearer <Supabase access token>`. The server verifies it through Supabase Auth and loads its database role. Never send secret/service keys from the browser. Guest management uses `X-Booking-Token: <private token>`. A fabricated/missing session returns 401 for protected endpoints; insufficient permissions return 403. Missing and inaccessible reservations both return 404.

## Public and customer routes

| Method and path | Inputs | Result |
| --- | --- | --- |
| GET `/health/live` | None | `{ "status": "ok" }` |
| GET `/health/ready` | None | Database readiness or 503 |
| GET `/settings` | None | Timezone, capacity, duration, slots, lead/cancellation notice, party/horizon limits, opening hours |
| GET `/categories` | None | Categories with published items, ordered by position/name |
| GET `/menu` | `page`, `pageSize`, optional `category` UUID, `dietary`, `q` | Published menu page; prices are integer paise |
| GET `/availability` | Required local `date=YYYY-MM-DD`, `guests` integer | `{ "slots": [{"starts_at":"UTC timestamp","available":true}], "timezone":"Asia/Kolkata" }` |
| POST `/reservations` | Body below, required `Idempotency-Key` UUID, optional bearer identity | 201 new or 200 replay, reservation and guest token for guest creation |
| GET `/me` | Bearer required | `{ "id": "UUID", "role": "customer|staff|admin" }` |
| GET `/reservations/mine` | Bearer required, pagination | Current customer's reservation page |
| GET `/reservations/:id` | Owner bearer, staff bearer or private guest token | Current reservation |
| PATCH `/reservations/:id/status` | Credential, `status`, current integer `version` | Updated reservation or conflict |
| GET `/reservations/:id/audit` | Same access as reservation | Ordered change events |

Auth signup/signin/reset/signout are handled by the browser Supabase SDK rather than a second password-handling API. Email confirmation and allowed redirect URLs are configured in Supabase.

Example create request (replace time with a future slot returned by availability):

```http
POST /api/reservations
Content-Type: application/json
Idempotency-Key: 42f121d0-96e1-4bfd-b3a7-e65916c9fcf3

{
  "name": "Demo Guest",
  "email": "demo@example.test",
  "phone": "+91 98765 43210",
  "starts_at": "2026-10-15T06:30:00.000Z",
  "guests": 2,
  "notes": "A quiet corner, if available."
}
```

`website` is an optional honeypot that must be empty. Extra fields are rejected. Input is length-bounded and normalized; a client-supplied end time, status, user ID or role is not accepted.

```json
{
  "reservation": {
    "id": "57c682e8-2969-4a37-bf7d-b18887fbb71b",
    "user_id": null,
    "name": "Demo Guest",
    "email": "demo@example.test",
    "phone": "+91 98765 43210",
    "starts_at": "2026-10-15T06:30:00+00:00",
    "ends_at": "2026-10-15T08:00:00+00:00",
    "guests": 2,
    "notes": "A quiet corner, if available.",
    "status": "pending",
    "version": 1,
    "legacy_id": null,
    "created_at": "2026-10-08T06:00:00+00:00",
    "updated_at": "2026-10-08T06:00:00+00:00"
  },
  "replayed": false,
  "guest_token": "private-token-returned-only-to-the-creator"
}
```

Retry the identical normalized request with the same key. Replay returns the saved creation response and token. Read `/reservations/:id` for current state. A changed request using that key receives `IDEMPOTENCY_MISMATCH`; do not silently generate a new key after an uncertain network response. Save the private link/token before leaving a guest confirmation.

Cancellation:

```http
PATCH /api/reservations/57c682e8-2969-4a37-bf7d-b18887fbb71b/status
Content-Type: application/json
X-Booking-Token: saved-private-token

{"status":"cancelled","version":1}
```

For account customers, omit the guest token and provide the bearer token. Staff use the same route for permitted transitions; their authorization is rechecked in the SQL function. Customer/guest cancellation has a deadline. Menu content cannot be written directly through the Data API even with a staff JWT.

## Staff and administrator routes

| Method and path | Role | Inputs/result |
| --- | --- | --- |
| GET `/admin/metrics` | staff/admin | Actual counts: visits/guests today in cafe timezone, pending, total, published menu, failed/queued notifications |
| GET `/admin/reservations` | staff/admin | Pagination and optional `status`, name/email/phone `q`, cafe-local `date` |
| GET `/admin/menu` | staff/admin | Paginated published and draft menu items |
| GET `/admin/categories` | staff/admin | All categories |
| POST `/admin/categories` | staff/admin | `{name,slug,position}`; returns created category |
| POST `/admin/menu` | staff/admin | Menu body below; 201 created |
| PUT `/admin/menu/:id` | staff/admin | Same body plus current `version`; version-checked update |
| POST `/admin/uploads` | staff/admin | One multipart `file`, JPEG/PNG/WebP, up to 3 MiB/16 million decoded pixels; returns `{path,url}` |
| GET `/admin/notifications` | staff/admin | Paginated event IDs/status/attempts/safe last_error, no raw payloads |
| PUT `/admin/users/:id/role` | admin | `{ "role": "customer|staff|admin" }`; last admin cannot be demoted |

```json
{
  "category_id": "10000000-0000-4000-8000-000000000002",
  "name": "Coffee",
  "description": "Cafe-approved description.",
  "price_paise": 18000,
  "dietary": "vegetarian",
  "image_path": null,
  "published": true,
  "featured": false
}
```

Upload first, then save the returned immutable `menu/...webp` path on the menu item. Arbitrary URLs and SVG are rejected. Set `published=false` to retire an item; physical deletion is intentionally not exposed. `sample_data` is set by development seed and cleared when staff edit a sample into real content; clients cannot assign it.

## Errors and limits

```json
{
  "error": {
    "code": "CAPACITY_EXCEEDED",
    "message": "That time is fully booked. Please choose another.",
    "requestId": "34d52177-bc15-4fa7-aea5-523c67077094"
  }
}
```

| Status | Common codes | Client action |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_INPUT`, `INVALID_IMAGE` | Correct the input |
| 401 | `UNAUTHORIZED` | Sign in again |
| 403 | `FORBIDDEN` | Check role/cancellation deadline |
| 404 | `NOT_FOUND` | Check reference and private credential |
| 409 | `CAPACITY_EXCEEDED`, `IDEMPOTENCY_MISMATCH`, `STALE_VERSION`, `INVALID_TRANSITION`, `TOO_EARLY_FOR_STATUS`, `LAST_ADMIN` | Refresh state or select a valid action/time |
| 413 | `UPLOAD_TOO_LARGE` | Reduce image size |
| 422 | `OUTSIDE_BOOKING_RULES` | Choose a returned valid slot/party/date |
| 429 | `RATE_LIMITED` | Back off; `Retry-After: 60` is a minimum hint, not the full booking budget reset |
| 503 | `SERVICE_UNAVAILABLE`, `UPLOAD_FAILED` | Retry safely; reuse the original booking key |

Default durable limits are 120 general requests/minute/IP, eight successful new bookings/hour/IP and normalized email, and ten image uploads/hour/IP. Idempotent booking replay bypasses booking budgets but still observes general request limits. Missing/invalid proxy trust changes which address is counted; configure it explicitly at deployment. Health routes are exempt from general budgets. API errors never include SQL, stack traces, credentials or provider response bodies.
