# Firebase migration, cutover and rollback

This implementation prepared tooling only. No production export, import, password transfer, file transfer or cutover was performed. The original live application remains under its existing operator control.

## Source and destination

The inspected source collections are `categories`, `menuItems` and `reservations`. Reservations have local `date`, 12-hour `time`, string/numeric `guests`, `specialRequests`, `status` and `createdAt`. The actual booking source did not store user ownership. Do not invent ownership from email matches. Auth existed for staff login, with no staff/admin distinction in source rules. Actual uploads used Cloudinary; check Firebase Storage independently before deciding it is empty. No MongoDB source was found.

Create a separate Supabase staging project. Apply versioned SQL using either the CLI or the operator runner, never both on the same project. The operator runner's default dry run executes migrations in a transaction and rolls it back, checking actual SQL validity. Applied checksums reject edited migration files. Seeds are labelled development data; use an empty menu destination for production migration, not development seeds.

Take a backup/export and record the Git revision, deployment configuration, source counts, Firestore indexes/rules, authentication providers and storage inventory. Save private exports only in ignored `migration/private` or an encrypted operator location. Do not commit user exports, hash parameters, signed URLs, account mappings or credentials.

## Export Firestore

The read-only REST exporter follows pagination and decodes Firestore field types into ordinary JSON. Obtain a short-lived OAuth access token with read access through an operator's Google tooling, then run:

```powershell
$env:GOOGLE_ACCESS_TOKEN = 'SHORT_LIVED_OPERATOR_TOKEN'
npx tsx scripts/export-firestore.ts --project piccolo-cafe-b9b2a
```

It writes `migration/private/firestore.export.json` and prints collection counts, not personal data. The project ID is taken from the archived configuration; confirm it against the actual production owner before exporting. Independently back up Firestore through its official export workflow; the JSON helper is a relational transformation input, not a full disaster-recovery backup. Inventory collections outside the three implemented features rather than silently discarding them.

## Authentication: deliberately separate

Export Firebase accounts through the operator CLI, for example `firebase auth:export migration/private/users.export.json --format=json --project ACTUAL_PROJECT`. Firebase passwords are hashes with project-specific parameters; browser sessions do not transfer. The current [official Supabase Firebase migration guide](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth) and [Firebase Auth export documentation](https://firebase.google.com/docs/cli/auth) describe hash export/compatibility options. This project did not verify source hash parameters or provider version compatibility, so its supplied importer chooses a password-reset strategy.

```powershell
npm run migration:users -- --file migration/private/users.export.json
npm run migration:users -- --file migration/private/users.export.json --apply
```

Dry-run validates account structure/duplicate emails without writing. Apply creates accounts through Supabase's server admin API with random, undisclosed passwords and preserves verified-email and disabled states. It never sends reset mail during import and never grants staff roles. A disabled source user stays banned. Existing target emails require matching server-owned `app_metadata` migration tags; customer-editable metadata is never proof of a prior import. Other collisions stop for independently verified account linking. These tags permit recovery after a cross-system partial failure before the mapping file was written. Legacy account creation and last-sign-in epoch timestamps, when exported, are retained in those server-owned tags; Supabase records its new account creation time independently. Safe rerun regenerates `user-map.export.json`.

After cutover, send account-recovery instructions through an approved communication process or let users request a reset at `/account`. Verify delivery domain, redirects, confirmation and reset end-to-end in staging. Existing OAuth provider identities require separate provider configuration and verified linking; this importer is limited to email accounts. Accounts missing email fail validation for review. Do not claim Firebase staff accounts as administrators automatically. Bootstrap one verified admin through the operator command, then assign reviewed staff accounts through the administrator screen.

If password-hash migration is later chosen, implement and test the specific official format with exported hash parameters on disposable accounts first. Do not replace hashes by guessing an algorithm or claiming unchanged passwords work without testing. Force fresh sessions at cutover regardless.

## Stored files

Inventory menu image URLs in Firestore, Cloudinary objects and Firebase Storage objects. Download intended public menu files through operator-approved tooling into `migration/private/files`. The import intentionally accepts local files instead of fetching arbitrary database URLs, preventing an import-time SSRF path. Create a manifest:

```json
[
  {
    "source": "https://source-provider.example/original-menu-image.jpg",
    "file": "original-menu-image.jpg",
    "sha256": "ACTUAL_64_CHARACTER_LOWERCASE_SHA256"
  }
]
```

```powershell
npm run migration:files -- --manifest migration/private/files.export.json --root migration/private/files
npm run migration:files -- --manifest migration/private/files.export.json --root migration/private/files --apply
```

The tool validates source containment, checksums, size/pixels and static allowed formats. It re-encodes WebP to deterministic content-addressed paths in the public menu-images bucket. It verifies already-present content before accepting a safe rerun. Apply writes `image-map.export.json`. Review visual output; metadata and original encoding are deliberately removed. Keep original provider objects intact during staging/cutover/rollback. Cafe source assets remain under frontend version control; only uploaded images move to Supabase Storage.

## Relational data import

Review the normalized export and mappings. Preserve actual `createdAt`, known status and local start time. `ends_at` uses the explicitly chosen destination duration because the original model did not record duration. Document that assumption for historical records. Imported guest bookings have no token and are staff-only until an operator verifies the guest and establishes a recovery process; no email-based auto-claiming is implemented.

```powershell
npm run migration:import -- --file migration/private/firestore.export.json --image-map migration/private/image-map.export.json --user-map migration/private/user-map.export.json
npm run migration:import -- --file migration/private/firestore.export.json --image-map migration/private/image-map.export.json --user-map migration/private/user-map.export.json --apply
```

Omit map arguments only when there are no corresponding images/explicit user relationships. Missing source timestamps, unknown statuses, invalid prices/times, duplicate IDs, unmapped categories/users/images and capacity violations stop the import. Historical active reservations count toward capacity; an already-overbooked source requires operator reconciliation, never a silent bypass. The source model's terminal statuses are retained. All relational inserts/audit/import-checksum rows are one transaction; dry run rolls it back. Imports set the audit actor kind to migration and suppress notification events, preventing unexpected customer mail.

Unique `legacy_id` values make reruns insert-only. Source checksums reject changed exports after the first import, requiring a reviewed delta migration instead of overwriting live staff edits. Compare per-status totals, earliest/latest timestamps, prices, category relations, explicit mapped ownership and object checksums to the source. Source timestamps are preserved to JavaScript millisecond precision; save original exports for any higher precision. No obsolete collection should be dropped until reconciliation is signed off by the operator.

## Staging verification and cutover

1. Apply SQL to fresh staging. Rehearse imports and compare counts/relationships/files. Test Auth signup, old-account reset/linking and staff bootstrap. Replace all development sample content before exposing the real cafe menu.
2. Run type checks, lint, unit/database/browser tests and real Supabase Data API/Storage/Auth checks against the configured local stack. Repeat equivalent manual access attempts in staging. Validate the verified email provider, worker crash recovery, receipt deduplication, dashboards and structured logs. Record what passed.
3. Confirm opening hours, timezone, capacity, party/duration, cancellation and pending-booking policy with the cafe. Capture backups of destination PostgreSQL and original providers. Prepare the old deployment artifact and routing configuration for rollback.
4. Schedule a short booking write freeze. Stop source guest writes and staff edits through operator-approved source controls; keep public menu readable. Export final source data. If staging imports already exist and final data changed, use a new empty production target or a reviewed delta script. The importer intentionally refuses changed source records.
5. Import/validate the final production target. Provision restricted runtime credentials. Deploy the API, worker and static frontend to staging URLs first, set CORS/Auth redirects, then smoke-test without production customer notifications. Enable the notification worker with reviewed provider configuration.
6. Switch the public frontend/API routing only after the operator approves the concrete verified deployment. Monitor new bookings, lock waits, 4xx/5xx rates, notification age and account resets. Retain the source backup and old configuration for the agreed rollback window. This task has not switched routing or deployed anything.

## Rollback without losing new bookings

Before cutover, rollback is simply abandoning the staging target while leaving Firebase unchanged. After cutover, stop new writes first and retain a Supabase database/storage snapshot. Do not immediately reopen old Firebase guest booking: it would know nothing about new Supabase reservations and could overbook.

Prefer restoring the prior application deployment while keeping a booking maintenance page and staff's Supabase access until reconciliation finishes. Export every post-cutover reservation/state change/audit record, reconcile capacity and customer access, and create a reviewed reverse/delta migration before reopening source writes. No automatic reverse importer is supplied because ownership, guest access, audit and capacity semantics differ from Firestore. Preserve both systems' data and outbox delivery receipts; do not resend ambiguous emails blindly. Never roll back SQL by dropping production tables. Any schema rollback should be a versioned forward migration with backup and compatibility checks.
