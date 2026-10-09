# A junior developer's route through the code

Start with one request rather than trying to read every file. The refactor uses named steps, descriptive variables and smaller React components. Some functions are longer than before because intermediate values and conditions now have names.

The existing run-and-understand PDF covers setup and the complete system. This shorter guide explains the current code structure. Run the project using the setup instructions in the README before changing configuration.

## 1. Read the server in this order

| File                              | Question it answers                                      |
| --------------------------------- | -------------------------------------------------------- |
| `server/index.ts`                 | How does the API start and stop?                         |
| `server/config.ts`                | Which environment settings are required?                 |
| `server/db.ts`                    | How do we connect to PostgreSQL?                         |
| `server/app.ts`                   | How are plugins, shared hooks and routes connected?      |
| `server/modules/reservations.ts`  | What happens when someone books?                         |
| `server/modules/booking-rules.ts` | How do input checks, time slots and request hashes work? |
| `server/modules/auth.ts`          | How do we identify a customer or staff member?           |
| `server/errors.ts`                | Which errors may the browser see?                        |

`index.ts` reads configuration, creates the connection pool, checks the database role, builds the app, starts listening and registers shutdown callbacks. `app.ts` builds the API without starting it; this lets tests send requests without opening a port.

The setup in `buildApp` reads like a checklist:

```typescript
await registerPlugins(app, config.WEB_ORIGIN);
registerRequestHooks(app, services);
registerErrorHandlers(app);
registerHealthRoutes(app, database);
reservationRoutes(app, services);
menuRoutes(app, services);
adminRoutes(app, services);
```

Each helper is in the same file. CORS controls allowed browser origins, Helmet sets security headers, and multipart handles uploaded files. A hook runs before the route handler to add response headers and check request limits.

`services` is an ordinary object containing the database, configuration, identity verifier and rate-limit helpers. It is passed to routes so they can use these dependencies. Tests supply an isolated database and test verifier through the same entry point.

## 2. Follow one booking

Read the `app.post('/api/reservations', ...)` handler from top to bottom:

1. `actorFor` verifies a supplied session. A guest has no signed-in actor.
2. `uuid.parse` and `bookingSchema.parse` check the request key and form input.
3. The `booking` object lists the fields to save, in a stable order.
4. `fingerprint` hashes these normalized details. `guestToken` creates the private guest credential.
5. The database receives these values through numbered SQL parameters.
6. `create_booking` checks capacity and saves the booking, audit, email job and retry result together.
7. A new booking returns HTTP 201; a matching retry returns HTTP 200 with the saved result.

For example:

```typescript
const result = await database.query('select role from public.profiles where id = $1', [userId]);
const profile = result.rows[0];
```

`$1` is replaced by the first parameter, not by joining user text into SQL. `rows` contains the returned records. A result can have no rows, so access checks test whether `profile` exists.

Read the availability route next. `validSlots` walks from opening to closing time in configured steps. PostgreSQL checks existing occupancy for each candidate. This list is advisory: the final booking transaction must check again because someone else may book in the meantime.

## 3. Understand authentication separately from permissions

- `actorFor`: optional sign-in, suitable for guest-friendly routes.
- `requiredActorFor`: requires a verified signed-in customer, staff member or administrator.
- `staffFor`: also checks the database role; its `adminOnly` argument restricts team-role changes.

The browser sends a Supabase access token. The server asks Supabase Auth to verify it, then loads the role from `public.profiles`. Changing browser state or user metadata does not grant staff access.

`safeError` maps recognized failures to reviewed messages. Unrecognized failures return a generic service error. It also handles malformed thrown values, so an unusual error does not crash the error handler.

## 4. Read each staff tool independently

`src/app/Staff.tsx` checks access, displays the shared header/metrics and selects a tool. It delegates the actual screens:

| File under `src/app/staff` | Responsibility                                   |
| -------------------------- | ------------------------------------------------ |
| `StaffReservations.tsx`    | Search, status changes and booking history       |
| `StaffMenu.tsx`            | Menu editing, image upload and category creation |
| `StaffNotifications.tsx`   | Email delivery status                            |
| `StaffTeam.tsx`            | Administrator role assignments                   |
| `Pager.tsx`                | Previous/next controls shared by the tools       |

For a status change, follow `changeStatus`: set busy state, clear the error, call the API, reload the records and metrics, then clear busy state in `finally`.

For public booking, read `src/app/Booking.tsx`. `requestKeyFor` saves the last request before sending it. The same details and account reuse the key after a connection failure. `ManageBooking`, in the same file, loads or cancels a booking using its private token or verified owner session.

For account access, read `src/app/Account.tsx`. `authenticate` uses a `switch` with one case for each action: login, signup, reset and change password. `successMessages` holds the corresponding text.

## 5. Recognize a few TypeScript patterns

| Syntax                                       | Meaning in this project                                |
| -------------------------------------------- | ------------------------------------------------------ |
| `interface Actor { id: string; role: Role }` | The shape of a signed-in user's information            |
| `Promise<Actor>`                             | An async function eventually returns an actor          |
| `Actor \| null`                              | A guest may have no actor                              |
| `request.headers['x-booking-token']`         | Read a header whose name contains hyphens              |
| `actor?.id ?? null`                          | Use the ID if an actor exists; otherwise use null      |
| `useRemote<Page<Reservation>>(path)`         | Fetch a paginated list of reservations                 |
| `catch` / `finally`                          | Handle failure / clear busy state after either outcome |

Server imports ending in `.js` refer to the JavaScript produced by the TypeScript build. The development runner also resolves those imports from TypeScript source.

`useRemote`, in `src/app/hooks.tsx`, handles loading, error and data state. Its effect ignores old responses after navigation or a newer request and aborts abandoned fetches. The async `loadData` function makes success, failure and cleanup separate steps.

## 6. Leave the database guarantees intact while learning

Capacity locking, transactions, row permissions and notification leases solve real booking problems. Their SQL has not been rewritten in this readability refactor. Changing an already-applied migration would also invalidate its saved checksum.

Read `server/modules/notifications.ts` before its SQL: `processOne` claims a job, sends it, then marks success or schedules a retry. The helper names expose that flow. A lease expires after a worker crash, and its token prevents a late worker from acknowledging a job claimed by another worker.

Use `tests/integration/database.test.ts` as examples of those rules: last-seat contention, duplicate requests, cancellation, role checks and worker recovery. The architecture and system-design documents explain the trade-offs when you are ready for the SQL details.

## 7. Make one small change and verify it

Change a local heading or menu label first. Then trace a search parameter or API response. Before changing booking behavior, explain which existing test should still pass and why.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:embedded
npm run test:e2e
```

Stop development servers before browser tests. The native database and browser suites create isolated test data and do not require your live Supabase credentials. The separate `test:security` command requires a configured local Supabase stack, as described in the full setup guide.
