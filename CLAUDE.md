# Rumbo — Project Notes

Fleet management SaaS (Base44 backend + Vite/React front-end), multi-tenant via
`TenantLicense`. See `docs/permissions_matrix.md` for the role/permission model.

## Account & danger zone — added data export (module 7, 2026-08-18)

A portfolio-standard audit (`jospabloh/acacia-app-standard`, module 7) found
`DangerZone.jsx` (`src/components/admin/DangerZone.jsx`, rendered from
`Admin.jsx` for `owner`/`admin`) already had delegate-ownership and
delete-tenant flows, but no way to download the tenant's data first. New
`exportTenantData` function (service role, but every read explicitly filtered
by the caller's own `tenant_id` — never cross-tenant) returns every row
across the 14 operational entities (`Vehicle`, `Driver`, `Trip`,
`Maintenance`, `Part`, `FuelLog`, `Fine`, `InsuranceClaim`, `Alert`,
`Expense`, `RentCharge`, `VehicleDocument`, `UnitDayNote`,
`DashboardUnitPref`, `DriverDocument`) as one JSON payload; `DangerZone.jsx`
turns the response into a client-side download, placed above delegate/delete
("hazlo antes de eliminar").

**Verified:** `npm run lint`, `npm run build`, `npm run validate:rls`
(27 entities OK), `npm run test` (463/463) all pass.

## Module 3 (granular server-side permission enforcement, "G1") — fixed 2026-08-19

Previously deferred as "a multi-entity, multi-file initiative on the scale
of a dedicated pass" — now done. `docs/permissions_matrix.md`'s own "G1"
note ("These granular permissions currently control the UI only... does
not yet read permissions_config") is resolved.

**The gap:** entity RLS enforces the *role*-level access (owner/admin/
dispatcher/mechanic, `role:dispatcher` etc. in each entity's `$or`), but has
no way to see a tenant admin's own override in
`TenantLicense.permissions_config` (set via the Permisos por Rol panel). A
dispatcher an admin explicitly denied "Rentas:create" could still create a
`RentCharge` via a direct SDK call — RLS never narrows past the role check.

**Fix:** `base44/functions/guardedEntityWrite` — one parameterized Safe
function, now the sanctioned write path for all 17 module-scoped
operational entities (Vehicle, VehicleDocument, Driver, DriverDocument,
DriverPrivateNote, Trip, Maintenance, Part, FuelLog, Fine, InsuranceClaim,
Alert, Message, Channel, LocationRequest, Expense, RentCharge,
UnitDayNote). It:
1. Derives role and `tenant_id` from the caller's own profile (`user.role`,
   `user.data.tenant_id` — both server-authoritative, written only by
   `resolveTenant`), never from the request.
2. Checks `TenantLicense.permissions_config` via `moduleCan()` — an inline
   copy of `src/lib/modulePerms.js`'s `DEFAULT_PERMISSIONS`/`moduleCan`
   (Deno functions can't import from `src/`, so this is duplicated by hand;
   keep both in sync if the defaults change).
3. Re-derives every driver "own record" exception that exists in RLS
   independently of the configurable matrix — a driver's own `Trip`, their
   own `Driver.profile_id`, confirming their own pending
   `LocationRequest` — since `asServiceRole` bypasses per-record RLS and
   would otherwise let a driver touch *any* tenant record of that type.
4. Enforces `Message.create`'s unconditional `sender_id == caller` rule
   (the entity's RLS has no role branch at all for this op, not even for
   owner/admin) and re-checks it server-side rather than trusting the
   client-submitted value.

**Two entities needed a narrower gate than their nominal module implies**
(`ROLE_ONLY_ENTITIES` in `entry.ts`, bypassing `moduleCan` entirely):
- `Channel` shares the `messages` module with `Message` for
  permission-config purposes (drivers can send messages, so
  `messages:create` defaults true for them), but `Channel.jsonc`'s own RLS
  never allowed driver/mechanic to create a *channel* — only owner/admin/
  dispatcher. Applying the generic `messages` check would have wrongly
  granted drivers channel-creation.
- `LocationRequest` (module `location`) has **no `useModulePerms().can()`
  gate anywhere in the current UI** (confirmed by grep across
  `src/pages`/`src/components`) — `Location.jsx`'s "solicitar ubicación"
  button is unconditionally visible to any dispatcher who reaches the
  page. `DEFAULT_PERMISSIONS.dispatcher.location.create` is `false` by
  documented default; enforcing that for the first time here would have
  silently broken a live feature no tenant admin has ever had reason to
  configure. Treated instead as role-gated only (owner/admin/dispatcher,
  matching `LocationRequest.jsonc`'s own RLS exactly), plus the driver
  self-confirm exception above — same principle as `jospabloh/liuma`'s
  investigated-and-excluded `AppSession` finding: don't newly enforce a
  documented-but-never-wired restriction as a side effect of an unrelated
  fix.

**New `src/lib/guardedWrite.js`** — thin client wrapper
(`guardedCreate`/`guardedUpdate`/`guardedDelete`). Note this app's
`base44.functions.invoke()` returns `{ data: <body> }`, not the body
directly (different from some other apps in this portfolio) — the wrapper
unwraps that and throws on a non-`ok` body. Migrated 48 real call sites
across 20 files — near-mechanical, since the wrapper matches the entity
SDK's calling shape (data in, record out).

**Verification performed:** `npm run lint`, `npm run build`, `npm run
validate:rls` (27 entities, unaffected — no `.jsonc` file changed), `npm
test` (463/463) all pass. `deno` isn't available in this sandbox —
`guardedEntityWrite` gets its first live check once deployed to the Base44
backend (a repo commit alone doesn't deploy a new backend function — see
this portfolio's standard note on that). **Not verified:** an actual
browser session as a permission-restricted dispatcher/mechanic/driver — not
achievable in this environment. Risk is bounded the same way as every
other module-3 fix in this portfolio: every migrated call site preserves
identical behavior for anyone whose role/config combination already
granted access (verified case-by-case against each entity's own deployed
RLS and against which pages actually gate their buttons with
`useModulePerms().can()` today) — the only behavior change is that a user
an admin explicitly denied a specific module action now correctly fails
server-side instead of the write silently succeeding.
