# Changelog

All notable changes to Rumbo are documented here.

---

## [1.33.0] — 2026-08-26 — Cascade delete on tenant deletion; account-deletion ticket (modules 7+8)

`DangerZone.jsx`'s "Eliminar tenant" called
`base44.entities.TenantLicense.delete(tenant.id)` directly — it removed the
license row but left every operational entity (Vehicle, Driver, Trip, and 17
others) orphaned in the database, still tagged with a `tenant_id` that no
longer resolved to anything.

- New `base44/functions/deleteTenant/entry.ts` (service role). Re-derives
  `tenant_id` from the caller's own profile, re-reads the stored
  `TenantLicense` row and requires `stored.owner_email === user.email` —
  same discipline as `delegateOwnership` (module 14: an `admin` must not be
  able to delete the tenant, only its actual current owner). Cascades
  through every entity `grep -l tenant_id base44/entities/*.jsonc` finds (20
  entities — a more complete list than `exportTenantData`'s older 14, which
  predates Channel/Message/LocationRequest/Catalog/UsefulLink), deleting
  each matching row per entity in its own try/catch so one bad entity can't
  abort the rest. `User` rows are **detached**, not deleted (same shape as
  `manageMember`'s `remove` action) — the account survives, only tenant
  membership is cleared. `SupportTicket` rows are **kept** — a tenant's own
  support/audit history, not tenant-owned operational data; each row already
  carries a denormalized `tenant_name` from creation, so it stays readable
  after `tenant_id` no longer resolves to a live tenant. `TenantLicense`
  itself is deleted last, once the cascade is done.
- Per module 8 ("the account-deletion request in Module 7's danger zone is a
  ticket too, and it is the one nobody remembers to wire"), `deleteTenant`
  now fires a `SupportTicket` (category `other`) documenting exactly which
  entities were cascaded and their counts, and pushes it to Mission Control
  the same way `submitTicket` does — best-effort, never blocks the deletion
  that already happened.
- `nextTicketNumber`/`pushToMissionControl`/`stripHtml` extracted out of
  `submitTicket/entry.ts` into `_ticketHelpers.ts`, duplicated byte-identical
  per function directory (`submitTicket/`, `deleteTenant/`) rather than
  imported across directories — matching the same "Deno isolates each
  function directory" pattern this repo already uses for `_acaciaSign.ts`.
- `src/components/admin/DangerZone.jsx`'s three backend calls
  (`exportTenantData`, `delegateOwnership`, `deleteTenant`) all migrated to
  `src/lib/invokeFunction.js`'s `invokeOkFunction()` — raw
  `base44.functions.invoke()` silently drops a function's real error message
  on any non-2xx response (see the 2026-08-26 `guardedWrite.js` entry
  below); this closes the same gap for the danger-zone's own three calls.

**Verified:** `npm run lint` (20 endpoints, techo 40), `npm run build`, `npm
run typecheck`, `npm run validate:rls` (27 entities OK, no schema change),
`npm run test` (468/468) all pass. `deno check --node-modules-dir=none`
against `deleteTenant/entry.ts`, `submitTicket/entry.ts`, and both
`_ticketHelpers.ts` copies all pass clean (fixed a pre-existing
`error.message` cast in `submitTicket/entry.ts`'s outer catch as a
drive-by, found only because `deno check` now runs against that file).

**Not verified:** live deploy (pending merge + `npm run deploy`) and an
actual browser session as a tenant owner running the delete flow end to
end. See `CLAUDE.md` for the full writeup, including what was deliberately
NOT cascaded and why.

---

## [1.32.0] — 2026-08-26 — About screen: contact + ACACIA acknowledgment (module 21)

`acacia-app-standard`'s module 21 asks every portfolio app for one screen —
reachable from account/settings, not buried — that answers "what does this
app do, what changed, what version am I on, and who do I ask." Rumbo's
`Help.jsx` already had three of the four (a searchable manual, the
in-app changelog from module 6, the version stamp); this adds the fourth:
a support email and a direct channel distinct from the in-app ticket system
above it, plus a short acknowledgment of who stands behind the app.

- New "Contacto" card in `Help.jsx`: `soporte@acaciaco.com.mx` (the same
  default `submitTicket` already falls back to server-side) and
  `SUPPORT_URL` (`acaciaco.com.mx/rumbo`, already used for the license
  renewal banner in `Layout.jsx` — reused rather than a second URL
  invented for this card).
- "Hecho con cariño para floteros y flotillas en México — un producto de
  ACACIA Consultoría," plus a rights line, matching the voice already used
  in `Landing.jsx`'s public footer.

Purely additive UI copy — no RLS, schema, or function change.

**Verified:** `npm run lint`, `npm run build`, `npm run typecheck`, `npm run
test` (468/468) all pass.

---

## [1.31.3] — 2026-08-26 — Invite-a-teammate fixed: was calling Base44's platform invite, not the app's

Found while verifying the invite path so a real user (Fer) could be added to
a live tenant. `InviteForm.jsx` (Admin → "Invitar usuario") called
`base44.users.inviteUser(email, role)` — **not**
`base44.auth.inviteUser(email, role)`. These are two different SDK modules
hitting two different endpoints:

- `base44.users.inviteUser` → `POST /apps/{id}/runtime/users/invite-user`,
  restricted client-side to `role: 'user' | 'admin'` (throws otherwise).
  This is Base44's own **platform/builder** invite — inviting someone as a
  collaborator on the app itself in Base44's studio. Passing `'admin'` here
  grants **co-admin access to build/edit this app's schema, functions, and
  deploys** — nothing to do with this app's own tenant role model.
- `base44.auth.inviteUser` → `POST /apps/{id}/users/invite-user`, no role
  restriction. This is the one meant for onboarding an actual **app end
  user**; the invitee's real role in this app already comes from `members[]`
  (written right below the call), the same server-authoritative path the
  join-code flow uses (`joinTenant`/`resolveTenant`).

Two real consequences of calling the wrong one:
1. **Functional bug:** the role `<Select>` offers 6 options (everything but
   Owner); only 2 (`admin`, `user`) pass the restricted call's check. The
   other 4 — Dispatcher, Mecánico, **Conductor (the form's own default)**,
   Socio — threw immediately, uncaught (`send()` had no try/catch), leaving
   the button stuck on "Invitar" with no feedback at all.
2. **Privilege-escalation risk:** picking "Admin" (meant as this tenant's
   business-level admin) *did* pass the check — and would have silently
   handed that invitee real Base44-studio co-admin rights over the entire
   app, every tenant included, instead of just an admin role on their own
   tenant.

**Fix:** `InviteForm.jsx` now calls `base44.auth.inviteUser(email, 'user')`
— always the neutral platform role every self-registered user starts with;
the actual app role comes from the `members[]` write, unchanged. `send()`
now has a real try/catch with an error state rendered via `FormError`,
instead of an uncaught rejection.

**Verified:** `npm run lint`, `npm run build`, `npm run typecheck`, `npm run
test` (467/467) all pass. No RLS/schema change. Not verified: an actual
invite round-trip in the live app (no browser session in this environment)
— confirmed instead by reading both SDK modules directly
(`node_modules/@base44/sdk`, v0.8.44) and tracing exactly which one this
form called and what each does.

---

## [1.31.2] — 2026-08-26 — Dead login provider removed; guarded-write errors no longer swallowed

Both found via real user feedback on a live tenant (Car-Go Rent): two
prospective users hit three unrelated problems trying to get to work.
The third (a `TenantLicense.max_vehicles` override left below its own
plan's default, blocking new vehicles) was a data correction on that
tenant, not a code change — nothing here to release for it.

### Fixed

- **"Continuar con Apple" removed from Login/Register.** Sign in with
  Apple was never actually configured on this app's Base44 backend, so
  tapping it threw the platform's raw error
  (`Apple authentication is not enabled for this app...`) before any
  account existed — a dead end with no account for anyone to even notice
  was missing. `src/components/auth/parts.jsx`'s `SocialButtons` now
  offers only Google; the now-unused `AppleIcon.jsx` was removed.
  Generalized into a portfolio-wide rule:
  `jospabloh/acacia-app-standard` Module 10.
- **`guardedWrite.js` now surfaces the real error on a failed write.**
  `base44.functions.invoke()`'s functions client is plain axios
  (`interceptResponses: false`), so any non-2xx response from
  `guardedEntityWrite` (permission denied, billing blocked, not found,
  etc.) made the promise *reject* with a generic
  `"Request failed with status code N"` — the actual Spanish message
  `guardedEntityWrite` wrote into the response body was never read. The
  wrapper now reads `err.response.data` on that path and throws the real
  message instead, same as it already did for a 2xx response carrying
  `ok: false`. Covers all 48 call sites through this one wrapper.

**Verified:** `npm run lint`, `npm run build`, `npm run typecheck`, `npm run
test` (467/467, four new for `guardedWrite.js`) all pass. No RLS or schema
change — `npm run validate:rls` unaffected.

---

## [1.31.1] — 2026-08-24 — Close admin self-delegation of tenant ownership (module 14 finding)

### Security

Module 14's 2026-08-23 isolation audit found a within-tenant privilege
escalation: `TenantLicense.delete` keys on nothing but
`data.owner_email == {{user.email}}`, but `update` was open to any
same-tenant `owner` **or `admin`**, and `owner_email` had no field-level
lock. So an admin could self-delegate ownership from `DangerZone.jsx` and
then satisfy the delete condition — the "only the owner deletes" gate closed
nothing while an admin could become owner in one click. Documented but not
yet fixed as of that audit; fixed here.

- `base44/entities/TenantLicense.jsonc` — `owner_email` gets
  `rls.write:false`, same mechanism as the ten license fields from module 1
  (2026-08-19).
- New `base44/functions/delegateOwnership` (service role) — the only
  tenant-scoped path left to reassign `owner_email`. Re-reads the *stored*
  record and requires the caller to already be its `owner_email` before
  writing; the target must already be a member of the same tenant.
  `licensesAdmin`'s `patch` action is the other writer, unaffected —
  `APP_OWNER_EMAIL`-gated, platform owner only.
- `src/components/admin/DangerZone.jsx` — delegate/delete controls now
  render only for `isOwner(user.role)`; an admin sees an explanatory line
  instead. Delegate now calls `delegateOwnership` instead of writing
  `TenantLicense` directly.
- `docs/permissions_matrix.md` — updated the two affected rows plus a new
  footnote.

**Verified:** `npm run lint`, `npm run build`, `npm run typecheck`, `npm run
validate:rls` (27 entities OK), `npm run test` all pass. Deploy to the live
Base44 backend and an authenticated browser session as a non-owner tenant
admin were not achievable in this environment — see CLAUDE.md.

---

## [1.31.0] — 2026-08-19 — Server-side enforcement of granular module permissions (module 3, "G1")

### Security

Closed the "G1" gap `docs/permissions_matrix.md` has documented since it was
written: the granular per-tenant module permissions (Permisos por Rol panel,
`TenantLicense.permissions_config`) only ever controlled the UI. Entity RLS
enforced the *role*-level access (owner/admin/dispatcher/mechanic) but had no
way to see a tenant admin's own per-role override — a dispatcher an admin
explicitly denied "Rentas:create" could still create a `RentCharge` via a
direct SDK call, since RLS's `role:dispatcher` branch doesn't know about
`permissions_config` at all.

- **New `base44/functions/guardedEntityWrite`** — the sanctioned write path
  for all 17 module-scoped operational entities (Vehicle, VehicleDocument,
  Driver, DriverDocument, DriverPrivateNote, Trip, Maintenance, Part,
  FuelLog, Fine, InsuranceClaim, Alert, Message, Channel, LocationRequest,
  Expense, RentCharge, UnitDayNote). Mirrors `src/lib/modulePerms.js`'s
  `DEFAULT_PERMISSIONS`/`moduleCan` exactly, re-derives the caller's role
  and tenant from their own profile (never the request), and reads
  `TenantLicense.permissions_config` before delegating the write via
  `asServiceRole`.
- Preserves every driver self-record RLS branch that exists independently
  of the configurable matrix — a driver's own `Trip`, their own `Driver`
  profile edit, and confirming their own pending `LocationRequest` — by
  re-deriving the same ownership check server-side (`asServiceRole`
  bypasses per-record RLS, so this function has to).
- Two entities (`Channel`, `LocationRequest`) needed a narrower role gate
  than their nominal module implies: `Channel` shares the `messages` module
  with `Message` for permission-config purposes, but its own RLS never
  allowed driver/mechanic to create one (only send messages); `location`
  has no `useModulePerms().can()` gate anywhere in the current UI, so
  enforcing its documented-but-never-wired default for the first time would
  have silently broken the live dispatcher "solicitar ubicación" flow —
  both are handled as role-only allowlists that exactly mirror their own
  `.jsonc` RLS, not the generic configurable-permission path.
- **New `src/lib/guardedWrite.js`** client wrapper
  (`guardedCreate`/`guardedUpdate`/`guardedDelete`) — same calling shape as
  the entity SDK it replaces, so migrating a call site was a near-mechanical
  swap. Migrated all 48 real write call sites across 20 files.

No behavior change for anyone whose role/config combination already granted
access — the only behavior change is that a user an admin explicitly denied
a specific module action now correctly fails server-side instead of the
write silently succeeding.

Verified: `npm run lint`, `npm run build`, `npm run validate:rls` (27
entities, unaffected — no `.jsonc` file changed), `npm test` (463/463) all
pass. `deno` isn't available in this sandbox — `guardedEntityWrite` gets its
first live check once deployed to the Base44 backend (a repo commit alone
doesn't deploy a new backend function).

## [1.30.3] — 2026-08-11 — Automated security audit: fixed a cross-tenant AppSession RLS gap

### Security audit result — one Critical finding, four more confirmed and fixed

Automated security, tenant-isolation, permissions, code quality, and release-readiness
audit (`audit/rumbo-full-review`). Three independent research passes (auth/session/
injection/PII/rate-limiting; code quality/architecture; an independent backend
cross-check of `docs/permissions_matrix.md` against the actual entity RLS, not
trusting the doc's own prose) plus manual verification before every fix.

- **CRITICAL — `AppSession.jsonc` cross-tenant exposure — FIXED.** RLS read
  `user_condition:{role:"admin"}` — an ordinary role any tenant's admin holds —
  where a service-role sentinel (as `AcaciaReplayKey.jsonc` already correctly used)
  was clearly intended per the file's own comment. Since `AppSession` has no
  `tenant_id` field, this granted every tenant's admin full read/update/delete
  over every OTHER tenant's session rows (email, device, timestamps, force-revoke)
  via a direct SDK call. Confirmed the `acaciaControl` bridge never relied on this
  branch (it reads/writes via `base44.asServiceRole`, bypassing RLS entirely) —
  tightened to `__service_role_only__` with no functional change to the bridge.
- **HIGH — `DriverPrivateNote.jsonc` granted `dispatcher` access to an "admin
  only" entity — FIXED.** Both this doc and the UI itself (`DriverDetail.jsx`:
  "Notas privadas (solo admin)") have always said owner/admin only; RLS and the
  frontend's `isAdmin` gate both actually allowed dispatcher. Removed dispatcher
  from RLS; replaced the frontend gate with a dedicated `canManagePrivateNotes` check.
- **CRITICAL (unconfirmed → closed) — systemic `tenant_id` tamper gap — FIXED.**
  Of 23 entities with a `tenant_id` field, only `User.tenant_id` had field-level
  `write:false`. Update RLS only checks a record's *existing* tenant_id, not what
  a patch payload might try to change it to — same bug class as the historical
  A33 `TenantLicense` fix, unaddressed everywhere else. Confirmed via grep that no
  real code path ever sends `tenant_id` in an update payload, so closing it on all
  21 remaining entities is zero-behavior-impact.
- **MEDIUM — `joinTenant` had no rate limit — FIXED.** Added a persistent
  per-user attempt counter (new `JoinAttempt` entity, service-role-only RLS,
  mirrors `AcaciaReplayKey`'s anti-replay pattern): 10 attempts / 15 min.
- **LOW — `githubRepos` built GitHub API URLs with no encoding — FIXED.** Added
  segment-aware `encodeURIComponent` helpers across all 8 call sites.
- **MEDIUM — driver-document uploads (license, INE, address-proof) had zero
  client-side validation — FIXED for this path.** Added a shared, unit-tested
  `validateUploadFile()` (extension allowlist + size cap) and wired it into
  `DriverForm.jsx`'s document and photo handlers; the photo handler also gained
  error handling it previously lacked. The remaining upload call sites (vehicle
  docs, tenant logos, note attachments) should get the same treatment as a
  fast-follow — the real enforcement is Base44's opaque `UploadFile` integration,
  which this repo can't verify, so this is defense-in-depth, not a replacement.
- **Code quality — FIXED.** `GitHubPage.jsx`/`SupabasePage.jsx` had no `.catch`
  anywhere (silent failures on the pages most likely to actually fail); added
  error state + banners. `Layout.jsx` (core, always-loaded) depended on
  `TenantOnboarding.jsx` (a one-time wizard) for `applyTenantColors` — moved to
  `src/lib/palettes.js` with 13 new unit tests (previously untestable). Removed
  `ContinueAs.jsx`, a fully-built, zero-import dead component.
- **`npm audit`: 5 → 0 vulnerabilities.** `react-router-dom` 6.30.4 → 7.18.2 and
  `vitest` 2.1.9 → 4.1.10, both previously carried as accepted risk (A44/A45/A47/A48)
  pending a major-version bump. No source changes required for either; full
  route-tree usage re-verified (all v6/v7-compatible library-mode APIs) and the
  full test/lint/typecheck/build suite re-confirmed green after both.
- Re-confirmed clean: no hardcoded secrets/API keys/tokens; `resolveTenant`,
  `generateAlerts`, `calculateCostPerKm`, `manageMember`, admin users list,
  `PermissionsPanel` all sound and unchanged; `acaciaControl` HMAC/anti-replay/
  entity-allowlist intact; all 7 `APP_OWNER_EMAIL`-gated functions match their
  documented gate; no `eval`/`new Function`/unescaped `innerHTML`; SDK version
  aligned (`@base44/sdk@0.8.41`) across frontend and all 14 backend functions.
  `validate:rls` (27 entities, was 26), `audit:tenant-scope`, lint, typecheck,
  all 463 unit tests (was 446; +17 new), and the production build all pass.
- Also documented (not code changes): `docs/permissions_matrix.md` corrected a
  stale "TenantLicense create: owner only" claim (RLS actually allows admin too;
  real creation path is server-side regardless) and added a new accepted-risk
  entry (G6) for `Catalog`/`UsefulLink`'s ungated `active:true` read branch —
  low-sensitivity data, flagged for a consumer-read pass before restricting.

## [1.30.2] — 2026-08-10 — Automated security audit: fixed a live cross-tenant RLS regression

### Security audit result — one Critical finding, fixed and deployed live

Automated security, tenant-isolation, permissions, code quality, and release-readiness audit. Triggered by discovering that `main`'s HEAD was an unreviewed, bot-authored commit pushed directly with no PR.

- **CRITICAL — TenantLicense cross-tenant update RLS regression (recurrence #2) — FIXED, deployed live.** A `base44-builder[bot]` commit ("Apply RLS security recommendations", pushed directly to `main` with no PR/review) removed the `data.members.email` branch from `TenantLicense.jsonc`'s `rls.update` — the same regression already fixed twice before (v1.29.0 finding A33, and a same-day recurrence fixed via PR #88). The bot re-applied the identical incorrect recommendation a second time after being reverted once already. Verified the deployed Base44 schema (not just the repo) had the same gap — this was live in production, not only a CI/repo issue. Restored the branch and redeployed via the Base44 schema API; CI's `audit:tenant-scope` check (which exists specifically to catch this class of regression) now passes again.
- **Root cause note (process, not code):** `main` has no branch protection, which is how an automated bot commit reached production without review twice. Recommend requiring PR review for pushes to `main`, including bot commits — flagged for owner action, not something fixable from this repo's code.
- Re-confirmed clean (no drift since the v1.30.1 audit, whose findings still hold): `resolveTenant` tenant-binding, `generateAlerts`/`calculateCostPerKm` tenant scoping and role gating, admin users list tenant filtering, `PermissionsPanel` save/reload, no hardcoded secrets/API keys/tokens, SDK version alignment (frontend and all 14 backend functions on `@base44/sdk@0.8.41`).
- No user-facing behavior change — permissions matrix and user manual content are unaffected; only the audit history and version are updated.

## [1.30.1] — 2026-08-03 — Automated security, tenant-isolation, permissions, and release-readiness audit

### Security audit result — no High/Critical findings; one recurring drift fixed, one dependency patched

Full automated security, tenant-isolation, permissions, code quality, and release-readiness audit covering all changes since v1.30.0 (the investor/socio role) — a bot-authored `@base44/sdk` package bump (`^0.8.40` → `^0.8.41`) was the only commit since. No open, draft, or disconnected pull requests existed at audit start; no stale branches carried unmerged work.

- **SDK version drift — FIXED (recurrence).** Frontend `@base44/sdk` had moved to `^0.8.41` while all 14 backend Deno functions remained pinned to `@0.8.40`. Re-aligned all 14 functions to `@0.8.41`. Same recurring pattern as A35/A41 — a frontend-only automated SDK bump not mirrored to backend functions.
- **`brace-expansion` ReDoS (high) — FIXED.** Non-breaking transitive dedupe via `npm audit fix` (`1.1.16` → `1.1.18`); no `package.json` range changes.
- **`react-router`/`react-router-dom` — accepted risk reconfirmed.** Same moderate open-redirect/SSR-hydration advisories as prior audits; still no non-breaking patch on the installed 6.x line (`6.30.4`, unchanged). Re-grepped every `navigate(...)`/`<Link to={...}>`/`useSearchParams`-adjacent call site — no redirect target is built from URL/query input.
- **Remaining dev-tooling vulnerabilities (`vitest`/`vite`/`esbuild`/`eslint` chain) — reconfirmed dev-only**, no production exposure; same accepted-risk lineage since v1.24.0.
- **`resolveTenant`, `generateAlerts`, `calculateCostPerKm`, `manageMember`, admin users list, `PermissionsPanel` save — spot-verified against source, all sound and unchanged**: tenant binding has no `all[0]`/first-match fallback risk; alerts and cost calculations are tenant-scoped and role-gated; admin user list is tenant-filtered; permissions panel persists to `TenantLicense.permissions_config` and reloads tenant context after save.
- **`USER_MANUAL.md` date stamp — FIXED.** Displayed "Updated 2026-07-27" even though the v1.30.0 investor-role commit (2026-07-30) had already updated its content; the stamp just wasn't bumped. No user-facing behavior changed this pass — date reference corrected only.
- Re-confirmed clean: no hardcoded secrets/API keys/tokens; tenant-isolation scoping across all server functions and entity RLS (`validate:rls` 26 entities, `audit:tenant-scope` — zero findings); route/page protection independent of UI hiding.
- `validate:rls`, `audit:tenant-scope`, lint, typecheck, all 446 unit tests, and the production build all pass.

### Documentation updates

- `docs/permissions_matrix.md` updated to v1.30.1: recorded this audit's findings (A50–A52).
- `USER_MANUAL.md`: no user-facing behavior changed this pass — date reference corrected to match its actual last content update.
- `CHANGELOG.md` updated with this v1.30.1 entry.
- `APP_VERSION` bumped to v1.30.1 in `src/lib/version.js` and `package.json`.

---

## [1.30.0] — 2026-07-30 — Investor/socio role, scoped to a subset of units

### New: `investor` role — read-only, scoped by `owner_group_id`

Some tenants split fleet ownership across informal partnerships ("sociedades") — e.g. 8 of
11 units belong to the tenant owner and 3 belong to a different investor, with the
possibility of further partnerships being added later for other subsets of units. Previously
every non-driver role that could log in saw the whole tenant; there was no way to grant
someone visibility into only part of the fleet.

- **New role `investor`** (`base44/entities/User.jsonc`), assignable from Admin like any
  other role.
- **New scoping field `owner_group_id`** (free-text tag, owner/admin-only to write) on
  `User`, `Vehicle`, `Maintenance`, and `RentCharge`. An investor sees exactly the units
  tagged with their own group — status/details, maintenance history, and rent-payment
  status (the driver's day/week payment record) — and nothing else in the tenant.
  `Maintenance`/`RentCharge` denormalize the tag from their `Vehicle` at write time (same
  pattern as the existing `driver_id` field), since Base44 RLS can't join across entities.
- **RLS hardening:** every investor read branch requires the record's `owner_group_id` to
  be non-null in addition to matching the user's, closing the "both sides unassigned/blank"
  failure mode that this codebase's `validate:rls`/`audit:tenant-scope` guards exist to catch.
- **New route `/investor/home`**, a single read-only panel (unit cards + maintenance list +
  rent-charge list, reusing the existing `rentUtils` status helpers). `RequireAccess`
  redirects an investor who lands on any staff route back to their own panel, mirroring the
  existing driver redirect; investor has no write access anywhere.
- **Admin UI:** assign `owner_group_id` inline on a user row (when role is Socio) and on the
  Vehicle form ("Grupo de sociedad").
- **Known gap:** the Reports-page quick-add shortcut (`RegistrarMenu`/`QuickIncomeModal`,
  fed by the `fleetUnitMetrics` aggregate rather than raw `Vehicle` rows) doesn't yet
  propagate `owner_group_id` — records created there won't appear in the investor's view
  until backfilled or re-saved from the main Rentas/Maintenance pages. Fail-closed
  (under-share, never over-share); documented in `docs/permissions_matrix.md`.
- `validate:rls` passes (26 entities). The one pre-existing `audit:tenant-scope` finding
  (`TenantLicense.update`) is unrelated to this change and was already present on `main`.

### Documentation updates

- `docs/permissions_matrix.md` updated to v1.30.0: new `investor` role, page-access column,
  RLS summary rows, and a new "Investor Unit Scoping" section explaining the `owner_group_id`
  design and why it's a scalar tag rather than a list/join.
- `APP_VERSION` bumped to v1.30.0 in `src/lib/version.js` and `package.json`.

### Deployment note

This PR ships the `base44/entities/*.jsonc` schema changes and the frontend. The Base44
backend schema must still be deployed separately (`base44 push`/dashboard sync) before the
new role/fields take effect at runtime — the `.jsonc` files alone don't change the live
backend.

---

## [1.29.2] — 2026-07-28 — Automated security, tenant-isolation, permissions, and release-readiness re-audit

### Security audit result — no High/Critical findings; no code drift; two accepted risks reconfirmed

Full re-run of the security, tenant-isolation, permissions, code quality, and release-readiness audit. No application commits landed since the v1.29.1 merge (HEAD unchanged at `83b22667`) and no open, draft, or disconnected pull requests or unresolved GitHub issues existed at audit start — this pass re-verifies the codebase from a clean baseline.

- **SDK version drift — none found.** Frontend `@base44/sdk` and all 14 backend Deno functions are already aligned at `^0.8.40`; no recurrence of the A35/A41 drift.
- **`npm audit` — 13 findings (5 moderate, 7 high, 1 critical), reconfirmed dev-tooling-only.** All are transitive `vitest`/`vite`/`esbuild`/`eslint`/`eslint-plugin-react` build/lint-chain advisories (`npm audit --omit=dev` returns only `react-router`); fixing needs breaking `vitest@4`/`eslint@10` upgrades. Applied `npm audit fix` for a non-breaking transitive dedupe of `@eslint/*` sub-dependencies (no vulnerability count change, no `package.json` range changes).
- **`react-router`/`react-router-dom` — accepted risk reconfirmed.** Same moderate open-redirect/SSR-hydration advisory as v1.29.1 (A44); no non-breaking patch exists on the installed 6.x line. Re-audited every `navigate()`/`<Link>`/`<Navigate>` call site — still no exploitable path (no SSR, no redirect target built from URL/query input).
- **ACACIA Mission Control bridge (`acaciaControl`/`AcaciaReplayKey`) — re-read line-by-line, unchanged and sound.** HMAC verification with timing-safe compare, persistent anti-replay store, 3-entity allowlist, email-relay validation all intact.
- Re-confirmed clean: no hardcoded secrets/API keys/tokens; tenant-isolation scoping across all server functions and entity RLS (`validate:rls` 26 entities, `audit:tenant-scope`); route/page protection independent of UI hiding.
- `validate:rls`, `audit:tenant-scope`, lint, typecheck, all 440 unit tests, and the production build all pass.

### Documentation updates

- `docs/permissions_matrix.md` updated to v1.29.2: recorded this audit's findings (A47–A49).
- `CHANGELOG.md` updated with this v1.29.2 entry.
- `APP_VERSION` bumped to v1.29.2 in `src/lib/version.js` and `package.json`.
- `USER_MANUAL.md`: no user-facing behavior changed this pass — not updated.

---

## [1.29.1] — 2026-07-27 — Automated security, tenant-isolation, permissions, and release-readiness audit

### Security audit result — no High/Critical findings; one recurring drift fixed, one documentation gap closed, dependencies patched

Full automated security, tenant-isolation, permissions, code quality, and release-readiness audit covering all changes since v1.29.0 (a `@base44/sdk` package bump and a `.gitignore`/repo-housekeeping commit — no application code had changed).

- **SDK version drift — FIXED (recurrence).** Frontend `@base44/sdk` had moved to `^0.8.40` while all 14 backend Deno functions remained pinned to `@0.8.37`. Re-aligned all functions to `@0.8.40`.
- **Dependency vulnerabilities — PATCHED where safe.** `npm audit fix` applied non-breaking patch updates (no `package.json` range changes) resolving `postcss`, `dompurify`, and `brace-expansion` advisories.
- **`react-router`/`react-router-dom` — accepted risk (no exploitable path found).** A moderate open-redirect advisory requires a major version bump to fully resolve; reviewed every navigation call site in the app and found none construct a redirect target from URL/query input, so there is no exploitable path today. Deferred as a future major-version upgrade rather than an automated breaking change.
- **Remaining dev-tooling vulnerabilities (vitest/vite/esbuild/eslint and their transitive deps) — reconfirmed dev-only**, no production exposure; unchanged accepted-risk lineage since v1.24.0.
- **Permissions matrix documentation gap — FIXED.** The `AcaciaReplayKey` entity and `acaciaControl` server function (an HMAC-signature-gated admin bridge used by external platform operations tooling, not part of the in-app role model) existed in the codebase but weren't documented in `docs/permissions_matrix.md`. Code review confirmed the implementation itself was already sound (signature verification, persistent anti-replay store, entity allowlist, no hardcoded secrets) — this was a documentation-only gap, now closed.
- Re-confirmed clean: no hardcoded secrets/API keys/tokens; tenant-isolation scoping across all server functions and entity RLS; route/page protection independent of UI hiding; admin users list tenant filtering.
- No open, draft, or disconnected pull requests found. No unresolved GitHub issues. CI green on `main` at HEAD.
- `validate:rls` (26 entities), `audit:tenant-scope`, lint, typecheck, all 440 unit tests, and the production build all pass.

### Documentation updates

- `docs/permissions_matrix.md` updated to v1.29.1: recorded this audit's findings (A41–A46), added the ACACIA Mission Control bridge section and RLS summary row.
- `USER_MANUAL.md`: no user-facing behavior changed — date reference updated.
- `CHANGELOG.md` updated with this v1.29.1 entry.
- `APP_VERSION` bumped to v1.29.1 in `src/lib/version.js` and `package.json`.

---

## [1.29.0] — 2026-07-13 — Automated security, tenant-isolation, permissions, and release-readiness audit

### Security audit result — one High and one Medium finding fixed

Full automated security, tenant-isolation, permissions, code quality, and release-readiness audit covering all changes since v1.28.0.

- **[HIGH] Cross-tenant privilege-escalation gap in `TenantLicense.update` — FIXED.** The rule that lets a tenant's own admin/owner update their license (billing plan, `permissions_config`, `join_code`, `members`) checked the actor's *global* role but not whether the record being updated was the tenant they are actually bound to. A user who is owner/admin of their own tenant, but whose email had also been added to a *different* tenant's member roster (e.g. a shared consultant/dispatcher invited by that tenant's admin), could call the update API directly against that other tenant's license and it would succeed — bypassing the app entirely, since the UI never exposes another tenant's license to begin with. Fixed by additionally requiring the record's own id to match the caller's bound `tenant_id` (server-authoritative, cannot be forged), so this update path only ever applies to the one tenant a user is legitimately bound to.
- **[MEDIUM] `Driver` record fields writable by a self-linked driver beyond their intended scope — FIXED.** A driver whose account is linked to their own `Driver` record could write to it via the entity's self-match update rule. The only field the app itself ever lets a driver edit on their own record is `phone` (`DriverProfile.jsx`). Everything else — `rating`, `license_expiry`, `background_check_date`, `hire_date`, `status`, `referral_bonus_paid`/`referral_credit`, license/INE/address files, `profile_id` — had no field-level protection, so a direct API call could let a driver inflate their own rating, mask an expired license from `generateAlerts`, or edit referral-bonus bookkeeping. All of these fields are now field-level restricted to owner/admin/dispatcher; `phone` remains self-editable.
- **[LOW] `SupportTicket` server-authoritative fields writable on direct create — FIXED.** `ticket_number`, `requester_id`, `requester_email`, and `tenant_name` are meant to be set only by the `submitTicket` server function (service role), but had no field-level write restriction, so a client could spoof them on a direct create call within their own tenant. Now `write:false` — server-authoritative, matching the pattern already used elsewhere (e.g. `User.tenant_id`).
- **SDK version drift — FIXED (recurrence of a previously-fixed issue).** The frontend `@base44/sdk` had moved to `^0.8.37` while all 14 backend Deno functions remained pinned to `@0.8.31`. Re-aligned all functions to `@0.8.37`.
- **`PermissionsPanel` stale-state bug — FIXED.** Saving role permissions persisted correctly to `TenantLicense.permissions_config` but never refreshed the shared tenant context, so the rest of the app (other open tabs, or this same session before the next 15-minute revalidation) kept using the pre-save permissions until a manual reload. Now calls the same `reload()` used by `BusinessSettingsPanel` after a successful save.
- **`DangerZone` "Delegar ownership" had no validation — FIXED.** The admin/owner-only ownership-transfer field accepted any typed string with no check that it belonged to an existing tenant member, risking an accidental transfer to a non-existent or mistyped email that would lock the tenant's admins out of managing it. Now validates the target against the tenant's own `members[]` list before enabling the action, and both delegate and delete now surface save errors instead of failing silently.
- Live-verified: all three updated entity schemas (`TenantLicense`, `Driver`, `SupportTicket`) deployed to Base44 and confirmed byte-for-byte identical to the repo via `list_entity_schemas`.
- Re-confirmed clean: no hardcoded secrets/API keys/tokens; `resolveTenant` tenant-binding fallback (no `all[0]` risk); `generateAlerts` and `calculateCostPerKm` tenant scoping and role gating; Admin users list tenant filtering; route/page protection backed by independent server-side/RLS enforcement, not just UI hiding.
- Re-affirmed accepted risk: 5 dev-only transitive vulnerabilities in `vite`/`vitest`/`esbuild` (test tooling only, no production exposure, fix requires a breaking `vitest@4` upgrade) — unchanged since v1.24.0 (`A17`).
- `validate:rls` (26 entities), `audit:tenant-scope`, lint, typecheck, all 440 unit tests, and the production build all pass.

### Documentation updates

- `docs/permissions_matrix.md` updated to v1.29.0: recorded this audit's findings (A33–A40), updated the `TenantLicense`/`Driver`/`SupportTicket` RLS summary rows, and clarified the G1 note.
- `USER_MANUAL.md`: no user-facing behavior changed (all fixes tighten existing, documented rules to match their own intent) — version/date reference updated.
- `CHANGELOG.md` updated with this v1.29.0 entry.
- `APP_VERSION` bumped to v1.29.0 in `src/lib/version.js` and `package.json`.

---

## [1.28.0] — 2026-07-08 — Bitácora attachments, aval/insurer fields, fondo de mantenimiento

### Bitácora attachments (`UnitDayNote`)

- Unit-day notes in `/reports` now support **multiple mixed-type attachments** per note — images, PDFs, Word docs, and plain text files. Attach by uploading a file, **pasting an image directly from the clipboard** (first such interaction in the app), or linking by URL.
- New `NoteComposer` component (`src/components/reports/NoteComposer.jsx`) replaces the old single-line note input; attachments render inline (image thumbnails, file-icon links for everything else) in the cell-detail "Comentarios" list.
- New `UnitDayNote.attachments` field (array of `{file_url, file_name, file_type}` objects) — additive, no RLS changes.

### New fields: aval, insurer details, maintenance reserve

- `Driver.aval_name` — guarantor/aval name, editable in the driver form and importable via CSV (`aval` column).
- `Vehicle.insurance_company` and `Vehicle.insurance_annual_cost` — complement the existing policy number/expiry fields, editable in the vehicle form and importable via CSV (`aseguradora`, `costo_anual_seguro`).
- `Vehicle.maintenance_reserve_weekly` — an optional weekly amount reserved toward a maintenance fund per unit, feeding the new **Fondo de mantenimiento** card (see below).

### Fondo de mantenimiento (Reportes)

- `fleetUnitMetrics` now computes, per unit and per selected range, how much would have been reserved at the configured weekly rate vs. actual `Maintenance` spend in that range, and the resulting balance.
- New `MaintenanceFundCard` (`src/components/reports/MaintenanceFundCard.jsx`), shown in a unit's drill-down "Mantenimiento" tab only when a weekly reserve is configured — most units won't have one yet, and the card simply doesn't render for them.

### CSV import: closed gaps vs. the full entity schema

- `drivers` import now also accepts `fecha_antecedentes`, `calificacion`, `aval`.
- `vehicles` import now also accepts `no_poliza_seguro`, `aseguradora`, `costo_anual_seguro`, `vencimiento_holograma`, `odometro`, `dia_cobro` (rent collection day), `estado`. Driver assignment is deliberately not part of this import (kept a manual post-import step) so vehicles and drivers stay import-order-independent.
- `maintenance` import now also accepts `categoria`, and `tipo` accepts `arreglo_mayor` (mapped to `major_repair`, previously unreachable via import).
- All additions are new trailing optional columns — existing templates, dedup keys, and phantom-record prevention are unchanged.

### Documentation updates

- `USER_MANUAL.md`: documented bitácora attachments, fondo de mantenimiento, the new driver/vehicle fields, and the extended import columns.
- `CHANGELOG.md` updated with this v1.28.0 entry.
- `APP_VERSION` bumped to v1.28.0 in `src/lib/version.js` and `package.json`.

---

## [1.27.0] — 2026-07-07 — Fleet unit metrics dashboard (Reportes) + mobile UX fixes

### Fleet unit metrics dashboard (`/reports`)

- New **Reportes** page: profitability, ranking, and forecasting per unit/driver.
  - **Utilidad por periodo × unidad matrix** — rows are time buckets (day of week / week of month / month depending on the selected range), columns are visible units; each cell shows that unit's profit with row/column totals. Clicking a cell opens a detail panel: revenue/cost breakdown, merged comments (own notes plus linked payment/maintenance notes), and client-computed insights (best day, % vs. fleet average, above-average streaks, unusually high cost).
  - **Range control** (Week default / Month / Year / custom range), a per-user **unit visibility selector** (saved per user, not per tenant, for fleets up to ~100 units), KPI row, productivity rankings (unit and driver), cost-per-km comparison chart, and maintenance-by-type/category breakdown.
  - **Predictive analytics per unit**: a simple linear-regression trend projection (not AI) with a stability pill, plus estimated next preventive-maintenance date and next tire-change date/km — from the unit's own history, falling back to new tenant settings `maintenance_interval_km` (default 5000) / `tire_life_km` (default 40000) when history is insufficient.
  - **Registrar** quick-add (ingreso / gasto / mantenimiento) directly from every unit card and every matrix cell's detail panel.
  - **GPS placeholder** ("GPS (Rainde) · Próximamente") per unit — no live integration yet, by design.
  - New backend function `fleetUnitMetrics` (owner/admin only) computes revenue/cost/profit/km/cost-per-km over one consistent date window shared by every metric, to avoid the window-mismatch bug class `calculateCostPerKm` previously documented.
- **Dashboard**: new "Utilidad por unidad · esta semana" preview card (Owner/Admin only) showing the current week's matrix; clicking a cell deep-links to that exact unit/day's detail on Reportes.
- **Rent balance carryover** (`Rentas.jsx`): an unpaid weekly rent balance now rolls into the unit's next period charge (instead of sitting as a separate open balance) and raises an admin alert (new `Alert.entity_type: 'rent_balance'`); surfaced as a banner on Reportes.
- New entities: `DashboardUnitPref` (per-user hidden-units list) and `UnitDayNote` (ad-hoc per-unit/day comments).
- Extended `Maintenance` with a `major_repair` kind and a `category` field (general/engine/brakes/electrical/tires/body/other); extended `RentCharge` with `carried_over_amount`/`carried_forward`.
- New route `/reports`, gated `RequireAccess page="reports"` (Owner/Admin), added to the Gestión nav group and the permissions matrix.

### Mobile UX fixes

- **Fixed: the mobile hamburger menu button was untappable app-wide.** The global toast-notification viewport sat at `fixed top-0 z-[100] w-full` with padding, leaving an invisible ~32px strip across the top of the screen — covering the menu icon — even with no toast showing. Added `pointer-events-none` to the viewport (individual toasts already opt back in via `pointer-events-auto`) and removed a dead duplicate viewport render that was never given any content.
- **Fixed: `/reports` overflowed horizontally on mobile** (measured 238px of overflow at a 390px viewport). `PageHeader`'s action slot now stacks below the title on narrow screens instead of squeezing it into a single-word column — a shared-component fix that's safe for every other page's smaller action slots. `RentArrearsBanner`'s "Ver en Rentas" button now stacks below the (possibly multi-line) warning message on mobile instead of floating mid-paragraph.
- **Fixed: toggling the Reportes range or unit-visibility reset scroll to the top.** The underlying query now keeps previously-loaded data visible while refetching (`placeholderData: keepPreviousData`), so a range/visibility change no longer drops the page to a loading skeleton and back.

### Other fixes bundled with this work

- `MaintenanceForm` now exposes the `major_repair` kind and the `category` field (previously only in the schema/list view, not enterable from the form).
- Fixed hardcoded preventive/corrective-only labels (in `MaintenancePage` and `VehicleDetail`) that would have mislabeled a `major_repair` record.
- Fixed `ExpenseForm`'s title showing "Editar gasto" for a prefilled-but-new record (used by Reportes' Registrar quick-add) instead of "Registrar gasto".

### Documentation updates

- `USER_MANUAL.md`: added the Reportes module section, noted the Dashboard preview card, rent carryover behavior (Rentas), and the maintenance kind/category options.
- `docs/permissions_matrix.md`: added the `/reports` page row, `fleetUnitMetrics` and rent-carryover guard rows, and RLS summary rows for `DashboardUnitPref`/`UnitDayNote` (done alongside the feature build).
- `CHANGELOG.md` updated with this v1.27.0 entry.
- `APP_VERSION` bumped to v1.27.0 in `src/lib/version.js` and `package.json`.

---

## [1.26.0] — 2026-07-06 — Automated security, code quality, tenant-isolation, permissions, and release-readiness audit

### Security audit result — no code-level vulnerabilities found

Full automated security, tenant-isolation, permissions, code quality, and release-readiness audit at v1.26.0 covering all modules added since v1.25.0.

- No hardcoded secrets, API keys, tokens, or credentials found.
- All 24 entity RLS rules verified correct (`data.tenant_id == {{user.data.tenant_id}}`); `validate:rls` passes.
- `audit:tenant-scope` passes — no unscoped read/update/delete branches found.
- Tenant isolation confirmed clean: Expense, AppSession, VehicleDocument entities all tenant- or self-scoped.
- `Expense` entity: owner/admin only read/write, write-gated by `write_access`. CLEAN.
- `AppSession` entity: user self-scoped (created_by_id) for read/create/update; delete admin only; no tenant_id leakage. CLEAN.
- `VehicleDocument` entity: tenant-scoped, owner/admin/dispatcher write, mechanic read. CLEAN.
- `aiIntake` (AI intake assistant): sanitizes user input before LLM call; no backend call; uses Base44 SDK InvokeLLM. CLEAN.
- Route protection: `/expenses` wrapped in `RequireAccess page="expenses"` (owner/admin only). CLEAN.
- Alert generation: tenant-scoped. CLEAN.
- Cost-per-km calculation: tenant-scoped, role-gated (owner/admin/dispatcher). CLEAN.
- Admin users list: filtered by `data.tenant_id`. CLEAN.
- PermissionsPanel save: persists to `TenantLicense.permissions_config` with error feedback. CLEAN.
- TenantContext fallback: no `all[0]` fallback risk. CLEAN.
- All 424 unit tests pass; lint, typecheck, build, validate:rls, audit:tenant-scope all clean.

### Documentation updates

- `docs/permissions_matrix.md` updated to v1.26.0: added `Expense` and `AppSession` entities to RLS summary, added `/expenses` page to page access table, updated version header, added audit findings A24–A32.
- `USER_MANUAL.md` updated: added Active Sessions section (Admin), updated Help & Support with AI intake assistant description, updated version date.
- `CHANGELOG.md` updated with v1.26.0 release entry.
- `APP_VERSION` bumped to v1.26.0 in `src/lib/version.js` and `package.json`.

### Features added since v1.25.0 (documented on this branch)

#### Active sessions (SessionHeartbeat + AppSession + force-logout)

- New entity **`AppSession`**: one row per end-user login/device. The client heartbeat (`SessionHeartbeat.jsx`) creates a row on login and refreshes `last_active_at` every ~60 s.
- ACACIA Mission Control can list active sessions and **force-logout** a specific session by setting `revoked_at`. The heartbeat checks its own row and calls `logout()` when revoked.
- RLS: each user owns their own rows (via `created_by_id`); platform admin (service role) has full access for the Mission Control bridge.

#### AI intake assistant (support questionnaire)

- A conversational **BA/PO assistant** (`aiIntake.js`, `AiIntakeChat.jsx`) interviews the user before a support ticket is escalated.
- Up to 6 structured questions; the model returns a structured `brief` (type, module, user story, acceptance criteria, priority, context). The brief travels inside the ticket body (Markdown) and as a structured `ai_brief` field for rich rendering in Mission Control.
- Input is sanitized to neutralize prompt-injection attempts before being sent to the LLM.

#### Expenses module (Gastos)

- New entity **`Expense`** (tenant-scoped, owner/admin only, write-gated by license).
- New page **`/expenses`** with category filter, month/total KPIs, and CSV import support.
- Expenses feed the Dashboard's "Egresos del mes" card.
- Categories configurable via **Configuración → Listas → "Categorías de gasto"**.

#### Insurance: configurable insurer name

- `InsuranceClaim.insurance_company` field: the insurer name is now configurable per claim via a dropdown populated from the **Catalog** (Configuración → Listas → Aseguradoras) instead of being freeform.

#### Import improvements

- CSV import extended to: **Fuel logs, Fines, Maintenance** (matched by vehicle plate/license), **Insurance claims**, **Rent charges**, **Expenses**, and **Catalog lists**.
- Rows that reference a vehicle/driver resolved by natural key (plate or license); phantom records are never created — a clear row-level error is shown instead.
- No-duplicate check: existing records matched by natural key are skipped.

#### Dashboard — command center

- New KPI tiles: **Egresos del mes** (fuel + fines + maintenance + insurance + general expenses), **Infracciones del mes**, **Taller (maintenances this month)**, **Licencia** status badge.
- App owner with their own fleet lands on their tenant Dashboard (not the Licencias console) — the Licencias link remains a single click away in the sidebar.

#### Business settings panel

- Admin → **Configuración del negocio** panel: configurable cost-per-km window (days), custom categories.
- `calculateCostPerKm` reads `TenantLicense.settings.cost_per_km_window_days`; defaults to 90 days if not set.

#### Bug fixes and hardening

- **ITSM folio:** support tickets now carry a human-readable sequential folio (`RUM-000001`), robust to deletions (derives from max folio, not row count).
- **Cross-tenant SupportTicket fix:** closed RLS branch that allowed any `admin` to read all tenants' support tickets; each branch is now scoped to `data.tenant_id` or `data.requester_id == user.id`.
- **`audit:tenant-scope` CI guard:** new script (`scripts/audit-tenant-scope.mjs`) added to CI to statically detect unscoped read/update/delete branches in every entity schema.
- **App build with custom domain:** `VITE_BASE44_APP_ID` baked into the bundle from `base44/.app.jsonc` so the app authenticates correctly on custom domains where Base44 doesn't inject `?app_id`.
- **Email validation:** `submitTicket` validates the requester's email format server-side before sending; strips HTML from subject/description to prevent email injection.
- **Dashboard app-owner routing:** fixed — an app owner with their own fleet no longer lands on `/licenses` but on their tenant dashboard.

### Remaining acknowledged vulnerabilities (dev-only)

| Vulnerability | Severity | Package | Risk | Status |
|--------------|----------|---------|------|--------|
| GHSA-f5bl-6b05-xchv (esbuild dev server) | Moderate | esbuild | Dev server only | Accepted |
| GHSA-67mh-4wv8-2f99 (esbuild) | Moderate | esbuild | Dev server only | Accepted |
| vite dev server | Moderate | vite | Dev server only | Accepted |
| GHSA-mw96-cpmx-2vgc (rollup path traversal) | High | rollup | Build time only | Accepted |
| vitest UI server | Critical | vitest | Only with `--ui` flag; not used in CI | Accepted |

---

## [1.25.0] — 2026-06-29 — Autenticación personalizada (diseño propio)

### Pantallas de inicio de sesión propias

- Rediseño profesional y en español de las páginas de autenticación generadas por Base44 (`/login`, `/register`, `/forgot-password`, `/reset-password`), con la marca Rumbo: layout de dos columnas, logo, panel de marca y formularios pulidos.
- Inicio de sesión social con **Google** y **Apple** (`loginWithProvider`), además de correo/contraseña.
- Registro con verificación **OTP** por correo (`register` → `verifyOtp` / `resendOtp`) y restablecimiento de contraseña (`resetPasswordRequest` / `resetPassword`).
- **Recordar / tap once:** `/login` reconoce al último usuario (correo prerellenado, contraseña enfocada, "Usar otra cuenta"). El token nunca se persiste en este flujo cosmético; la sesión real sigue siendo el token de Base44 + RLS.
- Piezas compartidas (`AuthLayout`, `SocialButtons`, campos) para mantener las cuatro pantallas consistentes.

## [1.24.0] — 2026-06-29 — Automated security & dependency audit

### Security — dependency hardening

- Removed unused `react-quill` dependency (was never imported in source). Eliminates quill XSS vulnerability **GHSA-4943-9vgg-gr5r** (moderate).
- Updated indirect dependency lock file via `npm audit fix`. Reduced total vulnerabilities from **23 to 5** (3 moderate, 1 high, 1 critical — all in dev-only tools: vite, vitest, esbuild; no production exposure).

### Security audit result — no code-level changes required

Full automated audit of security, tenant isolation, permissions, code quality, and release readiness at v1.24.0:

- No hardcoded secrets, API keys, tokens, or credentials found.
- All 21 entity RLS rules verified correct (`data.tenant_id == {{user.data.tenant_id}}`); `validate:rls` passes.
- Tenant isolation confirmed clean across all modules, entities, and server functions.
- Alert generation (`generateAlerts`): tenant-scoped and role-gated. CLEAN.
- Cost calculation (`calculateCostPerKm`): tenant-scoped, role-gated (owner/admin/dispatcher). CLEAN.
- Admin users list: filtered by `data.tenant_id`. CLEAN.
- PermissionsPanel save: persists to `TenantLicense.permissions_config` with error feedback. CLEAN.
- TenantContext fallback: no `all[0]` fallback for non-admin/owner users. CLEAN.
- Route protection: all routes guarded by `RequireAccess` or `RequireAppOwner`. CLEAN.
- Granular permissions matrix reviewed and confirmed current at v1.23.0 — no gaps.
- All 367 unit tests pass; lint, typecheck, build, and validate:rls all clean.

### Remaining acknowledged vulnerabilities (dev-only, require breaking changes to fix)

| Vulnerability | Severity | Package | Risk | Status |
|--------------|----------|---------|------|--------|
| GHSA-f5bl-6b05-xchv (esbuild dev server) | Moderate | esbuild | Dev server only — no production exposure | Accepted |
| GHSA-67mh-4wv8-2f99 (esbuild) | Moderate | esbuild | Dev server only | Accepted |
| vite dev server various | Moderate | vite | Dev server only | Accepted |
| GHSA-mw96-cpmx-2vgc (rollup path traversal) | High | rollup | Build time only — dev environment | Accepted |
| vitest UI server | Critical | vitest | Only when Vitest UI (`--ui`) is running — not used in CI | Accepted |

---

## [1.23.0] — 2026-06-22 — Automated security & permissions audit (documentation update)

### Docs — permissions matrix updated to v1.23.0

- `docs/permissions_matrix.md` updated from v1.0.2 to v1.23.0 to reflect all pages and entities added since 2026-06-15.
- Added missing pages: Catalogs, Links/Útiles, Help/Centro de ayuda, GitHub, Supabase, Licenses, Support Tickets, Test Data, and all driver routes.
- Added missing entities in RLS table: SupportTicket, Catalog, UsefulLink, DriverPrivateNote.
- Added missing actions: submit support ticket, manage member (suspend/reactivate/remove), manage catalogs, manage useful links.
- Corrected G2 (Known Gaps): page protection has been enforced at the route level since v1.18.0 via `RequireAccess` — the stale "client-side only" note was removed.
- Added complete audit findings table (A1–A14) confirming no security vulnerabilities and clean CI.

### Security audit result — no code changes required

All security, tenant isolation, and permissions checks passed against the v1.23.0 codebase. No Critical, High, Medium, or Low code-level vulnerabilities found. All 367 unit tests pass; lint, typecheck, and build are clean.

---

## [1.23.0] — 2026-06-21 — manual de usuario real e in-app (Centro de ayuda)

### Added — manual paso a paso dentro de la app

- La "Guía por módulo" (una línea por tema) se reemplaza por un **manual completo**
  en `src/lib/manual.js`: 19 secciones con temas, **pasos numerados** y notas, que
  cubren cada proceso de la app: primeros pasos, interfaz, dashboard, conductores,
  vehículos, taller (mantenimiento e inventario), rentas, financiero, alertas,
  mensajes, ubicación, importar, catálogos, enlaces, licencia, admin y permisos,
  app del conductor, soporte y la plataforma del owner de la app.
- Nuevo componente **`ManualGuide`** con **buscador** (filtra por sección, tema o
  texto de los pasos) y acordeón por sección. Integrado en el Centro de ayuda.
- Los títulos de sección coinciden con los que sugiere el flujo de soporte
  (`suggestSolution`), así que "revisa la sección X" siempre apunta a contenido real.
- Pasos redactados con las etiquetas reales de la interfaz (botones, campos,
  pestañas) para que cada instrucción coincida con lo que el usuario ve.

### Tests

- **+5 pruebas** (367 en total): integridad del manual (toda sección con
  id/título/ícono y temas con pasos; ids únicos) y que las secciones referidas por
  el suplemento de soporte existan en el manual.

## [1.22.0] — 2026-06-21 — soporte: manual primero, escalamiento por correo y SLA de 48 h

### Changed — flujo de ticket con desvío al manual

- Al abrir un ticket, **primero se sugiere una sección del manual** que podría
  resolver el problema (`suggestSolution`, por palabra clave del asunto/descripción
  con respaldo por categoría). El usuario puede cerrar si eso le ayudó o **escalar a
  soporte**.
- Al escalar, se confirma en pantalla y **por correo** que el caso fue escalado y que
  se responderá **dentro de 48 horas hábiles**, incluyendo la sección del manual
  sugerida.

### Changed — escalamiento por correo a soporte

- `submitTicket` ahora **envía dos correos** (best-effort): uno al equipo de soporte
  con el ticket y la sección sugerida, y otro **al solicitante** confirmando el
  escalamiento y el SLA de 48 h.
- El destino de soporte se lee del secret **`Support_email`** (también acepta
  `SUPPORT_EMAIL`/`APP_OWNER_EMAIL`) y, si no hay ninguno, cae a
  `soporte@acaciaco.com.mx` por defecto.

### Tests

- **+5 pruebas** (362 en total): `suggestSolution` (coincidencia por palabra clave,
  respaldo por categoría y genérico) y el SLA de soporte.

## [1.21.0] — 2026-06-21 — importador CSV robusto, refacciones con stock mínimo y portal del conductor

### Changed — importador CSV de verdad robusto

- **Parser nuevo** (`src/lib/csv.js`) que maneja campos entre comillas con comas y
  saltos de línea, comillas escapadas (`""`), CRLF y BOM. El anterior hacía
  `split(',')` y se rompía con cualquiera de esos casos.
- **Validación por fila + éxito parcial:** antes de importar, las filas se separan
  en válidas (con vista previa) y con problemas (listadas con su número de línea y
  motivo). La importación va fila por fila: si una falla al guardar, las demás
  continúan, y el resumen reporta importadas / omitidas / fallidas con su motivo.
  Antes era todo-o-nada y se detenía en el primer error.

### Added — inventario de refacciones con stock mínimo

- Nuevo campo **`min_stock`** en la entidad `Part`. La lista marca **stock bajo**
  (≤ mínimo) y **agotado** (0), con un resumen arriba, y ahora permite **editar**
  una refacción (no sólo crear).
- **Alertas automáticas de stock bajo**: `generateAlerts` crea una alerta
  (warning ≤ mínimo, critical si 0) por cada refacción bajo su umbral; se agregó el
  tipo `part` a la entidad `Alert`.
- `PartsList` migrado a la capa de datos (React Query) en vez de `useState`/
  `useEffect` manual, con `EmptyState`/`ListSkeleton`.

### Added — portal del conductor más completo

- **Registro de viajes** desde la app del conductor (plataforma, fecha, ingresos,
  distancia) para su vehículo asignado, con totales.
- **Edición de perfil**: el conductor puede actualizar su propio teléfono y ver su
  **vehículo asignado**. Los demás datos siguen a cargo del administrador.

### Tests

- **+13 pruebas** (357 en total): parser de CSV (comillas/CRLF/BOM/líneas vacías),
  validación y partición por fila, y lógica de stock bajo de refacciones.

## [1.20.0] — 2026-06-21 — soporte real: tickets, bandeja del owner y notificación por correo

La sección de Ayuda de 1.19.0 sólo enlazaba a un sitio externo. Esta versión
implementa un sistema de soporte de verdad, de punta a punta.

### Added — sistema de tickets de soporte

- **Nueva entidad `SupportTicket`** (`base44/entities/SupportTicket.jsonc`) con RLS:
  el owner/admin del tenant ve los tickets de su organización y cada usuario ve los
  suyos; el panel cross-tenant del owner de la app corre con service role.
- **Alta de tickets en la app** (`submitTicket`): desde el Centro de ayuda
  cualquier usuario abre un ticket (asunto, categoría, prioridad, descripción) con
  validación. Se crea del lado servidor —funciona incluso con la licencia en
  solo-lectura, que es cuando más se necesita soporte— y **notifica por correo** al
  equipo (`SUPPORT_EMAIL` o `APP_OWNER_EMAIL`).
- **«Mis solicitudes»** en el Centro de ayuda: el usuario ve sus tickets con
  estatus y el hilo de respuestas del soporte.
- **Bandeja de soporte del owner de la app** (`/tickets`, protegida por
  `RequireAppOwner`): lista todos los tickets de todas las organizaciones
  (`ticketsAdmin`, service role), con filtros por estatus, cambio de estatus
  (abierto → en proceso → resuelto → cerrado) y **respuesta que se envía por
  correo al solicitante**. Aparece en el grupo «Plataforma» junto a Licencias.

### Changed

- El botón «Abrir ticket de soporte» del Centro de ayuda ahora abre el formulario
  in-app real (antes sólo abría un enlace externo / `mailto`).
- `PLATFORM_NAV` pasa a ser una lista (Licencias + Soporte), reutilizada por la
  barra lateral y la paleta de comandos del owner de la app.

### Tests

- **+8 pruebas** (344 en total): catálogos de soporte, `labelFor`, `statusColor` y
  `validateTicket` (asunto/descripción obligatorios y longitudes mínimas).

## [1.19.0] — 2026-06-21 — UX: navegación con permanencia, ayuda/soporte, paletas premium y tarjetas accionables

Ronda de experiencia de usuario a partir de feedback directo: el menú ahora marca
con claridad dónde estás y recuerda tu última sección; hay un Centro de ayuda con
soporte; el branding ofrece paletas premium de un clic; y las tarjetas del
dashboard llevan a su sección con atajos de alta pre-cargados.

### Added — Centro de ayuda y soporte

- **Nueva sección «Ayuda»** (`/help`): guía por módulo en español (acordeón),
  atajos (⌘K), y un **botón para abrir ticket de soporte** + contacto por correo.
  Accesible para todos los roles (incluido el conductor) desde el pie de la barra
  lateral y desde el menú.

### Added — branding con paletas premium

- **8 paletas premium predefinidas** (`PalettePresets`) seleccionables de un clic,
  tanto en el onboarding como en el editor de marca del Admin, además de la
  extracción de colores del logo con IA que ya existía. En el onboarding se
  aplican en vivo para previsualizarlas.

### Added — tarjetas accionables y acciones rápidas

- **Todas las tarjetas del dashboard son accionables**: cada KPI lleva a su sección
  (vehículos, conductores, alertas, mensajes, rentas).
- **Acciones rápidas** en el dashboard: botones que abren directamente el
  formulario de alta de la sección correspondiente (vehículo, conductor,
  mantenimiento) vía enlace profundo `?new=1`, respetando permisos y modo lectura.

### Changed — navegación con permanencia e indicador claro

- **Indicador de sección activa** mucho más visible: barra de acento a la
  izquierda, fondo, texto en negrita e icono en color primario, con
  `aria-current="page"`. La detección de "activo" es robusta (exacta en la raíz,
  por prefijo en rutas anidadas).
- **Permanencia de navegación**: la app recuerda la última sección visitada y la
  restaura al recargar/volver a entrar (antes "se reseteaba al inicio"). Lógica
  pura en `src/lib/routePersistence.js`.
- **Pulido de Mantenimiento** con los primitivos compartidos (`PageHeader`,
  `EmptyState`, `ListSkeleton`), igual que Dashboard/Conductores/Vehículos/Alertas.

### Tests

- **+15 pruebas** (336 en total): paletas premium (hex válidos/únicos),
  permanencia de ruta (persistir/restaurar), `isNavItemActive` (raíz/anidado/
  parcial) y acceso a «Ayuda» por rol.

## [1.18.0] — 2026-06-21 — seguridad, pulido premium y navegación rápida (⌘K)

Versión de "bump" transversal: cierra una brecha de permisos a nivel de ruta,
unifica los patrones de UI en componentes compartidos, estrena un dashboard con
tendencia de ingresos y una paleta de comandos, y retira patrones heredados de
la capa de datos. Sin quitar funcionalidad: todo lo anterior sigue intacto.

### Security — permisos aplicados también a nivel de ruta

- **Guard de ruta `RequireAccess`.** Antes la barra lateral ocultaba las secciones
  por rol, pero las rutas no se protegían: un dispatcher podía abrir `/financial`,
  `/admin` o `/import` escribiendo la URL y la página se renderizaba (la RLS
  protegía los datos, pero la UI exponía controles que no debía). Ahora cada ruta
  revalida `can(rol, página)` —el mismo mapa que filtra la barra lateral— antes de
  renderizar. A un conductor que cae en una ruta del staff se le redirige a su
  panel; a los demás se les muestra una pantalla de "acceso restringido".
- **Ruta raíz inteligente.** `/` ya no asume el dashboard para todos: redirige a la
  primera sección accesible del rol (p. ej. un mecánico llega a Vehículos en vez de
  a una pantalla vacía) y a los conductores a su propia interfaz.
- Pantallas de "acceso restringido" y loaders ahora usan tokens del tema (antes
  tenían colores `slate-*` fijos que se rompían en modo oscuro).

### Fixed

- **Mensajes del conductor (404).** La navegación y la campana móvil del conductor
  apuntaban a `/driver/messages`, una ruta que no existía: tocar "Mensajes"
  llevaba a la pantalla de "página no encontrada". Se agregó la ruta.

### Added — nuevas funciones

- **Paleta de comandos (⌘K / Ctrl+K).** Buscador global para saltar a cualquier
  sección permitida y cambiar de tema, sin tocar el mouse. Reutiliza el mismo
  registro de navegación que la barra lateral, así que nunca ofrece una sección
  prohibida. Hay un botón "Buscar…" visible en la barra lateral.
- **Tendencia de ingresos en el Dashboard.** Gráfica de área de los últimos 7 días
  de cobros de rentas (con cifras tabulares y colores del tema/branding), para leer
  la operación de un vistazo.

### Changed — pulido de UI/UX consistente

- Nuevos primitivos compartidos: **`EmptyState`** (vacío con icono, texto y acción),
  **`PageHeader`** (encabezado uniforme) y **`ListSkeleton`** (esqueleto de carga en
  lugar del spinner suelto, para que la carga se perciba más rápida).
- Adoptados en Dashboard, Conductores, Vehículos y Alertas; reemplazan el
  `<p>Sin registros</p>` y los `<div className="flex justify-between">` copiados en
  cada página. Los estados vacíos ahora distinguen "aún no hay datos" de "sin
  resultados de búsqueda" y ofrecen la acción adecuada.
- La fecha del Dashboard se localiza en español (antes el día/mes salían en inglés).

### Changed — capa de datos sin patrones heredados

- **Registro central de navegación** en `src/lib/nav.js`: única fuente de verdad
  para la barra lateral, la paleta de comandos y los guards de ruta (no se pueden
  desincronizar).
- `Layout` y `App` ya no refetchean `auth.me()` con `useState`/`useEffect`: usan el
  hook cacheado `useMe()`. Los contadores de alertas/mensajes de la barra lateral
  pasan a los hooks `useAlerts`/`useMessages` (misma caché que el dashboard ⇒ una
  sola petición compartida) en vez del fetch manual que corría en cada montaje.
- Eliminado código muerto (`ProtectedRoute` que no se usaba en ninguna ruta).

### Tests

- **+10 pruebas** nuevas (321 en total): `nav.test.js` verifica que la navegación
  por rol nunca filtra una sección prohibida; `dashboard.test.js` cubre el cálculo
  de la serie de ingresos (agrupación por día, ventana, datos malformados).

## [1.17.0] — 2026-06-19 — forms: react-hook-form + zod con validación en cliente

### Changed — los 7 formularios de entidad ahora usan react-hook-form + zod

- **Validación en cliente con errores en línea.** Antes los formularios sólo
  tenían `required` de HTML y botones deshabilitados; ahora cada campo valida
  contra un esquema zod y muestra el error debajo del campo (placa o unidad
  obligatoria, conductor/vehículo obligatorio, monto > 0, calificación 0–5,
  año 1900–2100, etc.).
- **Esquemas centralizados y probados** en `src/lib/schemas.js` (uno por
  formulario), con **15 pruebas unitarias** nuevas que cubren campos
  obligatorios, rangos y coerción de números.
- Formularios convertidos: Vehículo, Conductor, Multa, Combustible, Reclamo de
  seguro, Mantenimiento y Nuevo canal.
- Los errores del servidor al guardar se muestran con `setError('root')`; el
  estado de envío usa `formState.isSubmitting`. Las cargas de archivos
  (fotos/documentos) siguen igual y guardan la URL con `setValue`.
- Sin cambios en la forma de los datos enviados al backend ni en la UI: misma
  estructura de payload, sólo se añade validación.

### Docs

- **Manual de usuario actualizado** (`USER_MANUAL.md`) a la versión 1.17.0: nueva
  sección «Interface & Appearance» que documenta el selector de tema claro/oscuro
  (1.16.0) y la validación de formularios en línea (1.17.0).

## [1.16.0] — 2026-06-19 — rediseño: tema claro/oscuro y estética "consola de operaciones"

### Added — tema claro + oscuro

- **Selector de tema claro/oscuro** (next-themes, ya en dependencias). El tema oscuro se
  mantiene idéntico al original y sigue siendo el predeterminado; se añade un tema **claro**
  completo. El selector está en el pie de la barra lateral.
- Las variables de color son semánticas, así que ambos temas funcionan en toda la app sin
  tocar componentes. **El branding white-label sigue mandando**: los colores del tenant
  (`applyTenantColors`) se aplican por encima de cualquier tema.

### Changed — estética "consola de operaciones" (data-forward)

- **Tipografía de datos en monoespaciada** (IBM Plex Mono con cifras tabulares): los KPIs del
  dashboard, las placas/unidades, los montos ($) de Rentas/Financiero/Licencia y los códigos
  se renderizan en mono para que los números se alineen y los identificadores se lean como
  datos. Es el elemento distintivo del rediseño.
- Radios de borde más nítidos (`--radius` 0.5rem → 0.375rem) para un acabado más técnico.

### Accessibility (de 1.15.x)

- Foco de teclado visible global (`:focus-visible`) y soporte de `prefers-reduced-motion`.

## [1.15.0] — 2026-06-19 — refactor: capa de datos completa y componentización

Refactor interno (sin cambios de comportamiento para el usuario). Continúa la migración
iniciada en 1.14.0.

### Changed — todas las páginas sobre la capa de datos React Query

- Migradas el resto de las páginas fuera del patrón manual `useState + useEffect`:
  **Mantenimiento, Financiero, Alertas, Catálogos, Ubicación, Enlaces útiles, Mensajes,
  Licencia (Billing) y las páginas del conductor** (Inicio/Perfil/Viajes).
- Nuevos hooks compartidos en `src/hooks/useEntities.js`: `useMe()` (perfil en caché),
  `useCurrentDriver()` (resuelve la búsqueda usuario→conductor que repetían las 3 páginas
  del conductor) y `useRawList()` (lecturas sin scope de tenant: `TenantLicense`, `User`).
- El refetch manual `load()` se reemplaza por invalidación de caché en toda la app.

### Changed — componentización de los archivos monolíticos

- **`Rentas.jsx` 635 → 308 líneas**: extraídos `src/components/rentas/` (rentUtils,
  ManualChargeModal, IngresosView, ReferralsView).
- **`Admin.jsx` 728 → 173 líneas**: extraídos `src/components/admin/` (roleConfig, UserRow,
  InviteForm, TenantEditor, JoinCodeCard, DangerZone).

### Added — primitivos de UI compartidos

- `ResponsiveModal` (hoja inferior en móvil / diálogo centrado en escritorio) y `FormError`,
  reemplazando markup duplicado en los modales. Un único `Spinner`/`PageLoader` reemplaza
  ~20 copias del spinner.

## [1.14.0] — 2026-06-19 — capa de datos, permisos y onboarding

### Changed — migración a React Query y capa de datos por tenant

- **Capa de datos centralizada** (`src/hooks/useEntities.js`): las páginas ya no obtienen
  datos con `useState + useEffect + Promise.all` ni un flag `loading` manual. Se introduce
  una capa sobre el SDK de Base44 basada en React Query (`useEntityList` +
  `useVehicles/useDrivers/useAlerts/useMessages/useRentCharges` y `useInvalidateEntity`),
  con caché, deduplicación de peticiones y refetch declarativo tras cada cambio. React Query
  ya estaba montado en `App.jsx` pero sin usarse. Migradas en esta versión: **Dashboard,
  Vehículos, Conductores, Mantenimiento, Financiero, Alertas y Catálogos**.
- **Spinner compartido** (`src/components/ui/spinner.jsx`): un único componente
  `Spinner` / `PageLoader` reemplaza ~20 copias del mismo markup repartidas por las páginas.

### Changed — permisos por rol

- **Admin y Owner siempre con acceso total y visible**: el panel *Permisos por Rol* ahora
  muestra una pestaña **Admin** (y Owner) con **todos los permisos activados**, bloqueada y
  no configurable, para ver el conjunto completo de un vistazo en lugar de solo un aviso.
- **Permisos nuevos por defecto en "Ver"**: cuando se agrega un módulo o acción nuevo al
  sistema, los roles no-admin lo reciben en **solo lectura** (`view: true`, escritura
  desactivada) en vez de quedar sin acceso. Implementado en `moduleCan` / `defaultPerm` con
  `NEW_PERMISSION_DEFAULT`, sin alterar los defaults explícitos ya existentes (verificado por
  los 296 tests unitarios).

### Added — onboarding guiado: crear o unirse a una organización

- **Hub de onboarding** (`src/pages/Onboarding.jsx`): cualquier usuario autenticado que aún
  no pertenece a un tenant pasa por una pantalla que lo guía a **crear su organización**
  (prueba de 30 días, sin tarjeta) o **unirse a una existente con un código**. Antes, un
  usuario que entraba con un correo externo caía directo en una app vacía, sin guía ni aviso.
- **Código de unión único por tenant** (`join_code` en `TenantLicense`): se genera al crear
  la organización y se muestra/copia/regenera desde **Administración**. Alfabeto sin
  caracteres ambiguos (sin 0/O/1/I/L) para dictarlo y teclearlo sin errores en el teléfono.
- **`createTenant`** (función de servidor): crea la organización y eleva al usuario a owner
  de forma controlada. Necesario porque un usuario recién registrado entra con rol `user` y
  la RLS no le permitiría crear el tenant ni cambiarse el rol desde el cliente.
- **`joinTenant`** (función de servidor): valida el código con service role (resuelve el
  huevo-gallina de RLS) y une al usuario con **privilegio mínimo** (`conductor`); el admin
  lo promueve después. No se puede unir a un tenant cancelado/suspendido.

### Added — gestión de miembros del tenant

- **Suspender / reactivar / quitar** usuarios desde Administración, vía **`manageMember`**
  (función de servidor): `write_access`, `suspended` y `tenant_id` son server-authoritative.
  Protege al owner del tenant y al owner de la app; nadie puede actuar sobre sí mismo.
- **Nombre para la app** (`display_name` en `User`): el admin asigna un nombre visible
  asociado al correo; si está vacío se usa el `full_name` de la cuenta.
- **Visibilidad del owner de la app**: la página de Licencias ahora muestra el código de
  unión y los correos de los miembros de cada tenant.

### Mobile

- Onboarding y pantallas de unión rediseñados mobile-first: objetivos táctiles grandes
  (h-12), inputs de 16px (evitan el zoom de iOS) y `safe-area` para el notch.

---

## [1.13.1] — 2026-06-17

### Changed — se usa el logo PNG oficial (provisto por el cliente)

- Se reemplaza la recreación en SVG por el archivo oficial **`public/rumbo.png`** (1024×1024).
- App: favicon (`index.html`), `LogoMark` (`Layout.jsx`) y onboarding (`TenantOnboarding.jsx`)
  apuntan a `/rumbo.png`.
- Landing `marketing/precios.html`: usa `rumbo.png` (relativo) — debe subirse en la misma
  carpeta que el HTML en el sitio externo.
- Se elimina `public/rumbo-logo.svg` (ya no se usa).

### Version

- `package.json` version `1.13.0` → `1.13.1`.

---

## [1.13.0] — 2026-06-17

### Added — logo oficial de Rumbo (dentro y fuera de la app)

- **`public/rumbo-logo.svg`**: logo oficial (auto de frente con pin de ubicación, blanco
  sobre verde) como SVG escalable. Una sola fuente, se sirve en `/rumbo-logo.svg`.
- **Dentro de la app**: el fallback de marca (`LogoMark` en `Layout.jsx`) y el onboarding
  (`TenantOnboarding.jsx`) ahora muestran el logo oficial en vez de la "R". El logo propio
  de cada tenant sigue teniendo prioridad donde aplica.
- **Favicon y título**: `index.html` usa el logo como favicon y el título pasa de
  "Base44 APP" a "Rumbo" (se quitó el `<link rel="manifest">` que apuntaba a un archivo
  inexistente).
- **Fuera de la app**: la landing `marketing/precios.html` usa el logo (SVG inline, sigue
  siendo un solo archivo autocontenido).

### Version

- `package.json` version `1.12.0` → `1.13.0`.

---

## [1.12.0] — 2026-06-17

### Added — planes comerciales con cupos de vehículos/conductores

Definición de los niveles de licencia y aplicación de sus cupos (antes `max_vehicles` /
`max_drivers` eran solo informativos).

- **`src/lib/plans.js`**: `PLAN_LIMITS` (trial 5/5, starter 15/20, pro 50/75, enterprise
  ilimitado), `PLAN_LABELS` (Prueba / Starter / Pro / Flotilla) y helpers
  `vehicleLimit()` / `driverLimit()` / `atVehicleLimit()` / `atDriverLimit()`. El cupo
  efectivo es `license.max_vehicles` (si está definido) y, si no, el default del plan;
  `0` / vacío = ilimitado.
- **Gate de creación** en `Vehicles.jsx` y `Drivers.jsx`: al alcanzar el cupo, se bloquea
  la creación con un mensaje de "mejora tu plan". El encabezado muestra `usados / cupo`.
- **Billing.jsx** muestra el cupo del plan (∞ para ilimitado) en vez del fijo "5".
- **SuperAdminPanel**: al cambiar el plan de un tenant se prellenan `max_vehicles` /
  `max_drivers` con los defaults del plan (editables); `0 = ilimitado` en el formulario y
  "Ilimitado" en la vista.
- **Tests**: +7 sobre cupos y límites.

> Alcance: el gate de cupos se aplica en el **frontend** (no es una frontera de seguridad;
> exceder el cupo no expone datos de nadie). Una aplicación dura a nivel de datos exigiría
> enrutar la creación por una función de servidor que cuente los registros del tenant.
> Tampoco se restringen módulos por plan todavía (los planes se diferencian por cupo).

### Version

- `package.json` version `1.11.2` → `1.12.0`.

---

## [1.11.2] — 2026-06-17

### Fixed — el acuse "entregado/leído" del conductor ahora sí persiste (RLS de Message)

Complemento de 1.11.1: aunque el conductor ya podía **leer** los mensajes, su acuse de
"entregado/leído" no se guardaba porque la RLS de `update` de `Message` solo permitía al
creador o al staff (fallaba en silencio en `loadMessages`).

- **RLS de `update` de `Message` extendida** a los destinatarios del canal
  (`channel_kind == "broadcast"` o `channel_driver_id == driver_profile_id`), igual que la
  de lectura.
- **Protección a nivel de campo (field-level `write`)** en `tenant_id`, `channel_id`,
  `channel_kind`, `channel_driver_id`, `sender_id`, `sender_name`, `body` y `audio_url`:
  solo el **creador o el staff** pueden escribirlos. Así un destinatario que pasa la RLS de
  update **solo** puede tocar `delivered` / `read`, nunca el contenido del mensaje (mismo
  patrón field-level que `User.role`). El gate de licencia (`write_access`) se mantiene.
- No requiere cambios de frontend: `Messages.jsx` ya marcaba `delivered`/`read` al abrir el
  canal; ahora la escritura es aceptada para el destinatario.

### Version

- `package.json` version `1.11.1` → `1.11.2`.

---

## [1.11.1] — 2026-06-17

### Fixed — los conductores no podían leer los mensajes que les enviaban (RLS de Message)

El advisor de seguridad de Base44 marcaba `Message` porque su RLS de lectura solo dejaba
leer a staff (owner/admin/dispatcher) y al **propio remitente** (`sender_id == user.id`).
Un conductor no podía leer los mensajes que le enviaban (broadcast o su canal directo),
porque esos mensajes llevan el `sender_id` del staff, no el suyo — el chat quedaba roto
del lado del conductor.

- **Nuevos campos denormalizados en `Message`: `channel_kind` y `channel_driver_id`**,
  copiados de `Channel.kind` / `Channel.driver_id` al crear el mensaje. Las RLS de Base44
  no hacen joins, así que la pertenencia al canal debe viajar en el propio mensaje.
- **RLS de lectura de `Message` extendida** para espejar la de `Channel`: además de staff
  y remitente, ahora deja leer cuando `channel_kind == "broadcast"` (todo el tenant) o
  `channel_driver_id == {{user.data.driver_profile_id}}` (canal directo del conductor).
  La escritura no cambia y el aislamiento por `tenant_id` se mantiene.
- **`Messages.jsx`** ahora setea `channel_kind` y `channel_driver_id` al crear mensajes
  de texto y de voz.

> Nota de deploy: los mensajes creados **antes** de este cambio no tienen los campos
> denormalizados, así que un conductor seguirá sin poder leer el histórico previo. Si
> hace falta, hay que hacer un backfill (copiar kind/driver_id del canal a sus mensajes).
> Pendiente aparte: el acuse "entregado/leído" del conductor aún no persiste porque la
> RLS de `update` de `Message` solo permite al creador o al staff (falla en silencio, sin
> regresión); habilitarlo requeriría permiso de update acotado al destinatario.

### Version

- `package.json` version `1.11.0` → `1.11.1`.

---

## [1.11.0] — 2026-06-17

### Added — bloqueo de escritura por licencia, aplicado en el backend (no solo UI)

Hasta ahora el corte por falta de pago (`readonly` / `disabled`) se aplicaba **solo en el
frontend**: un tenant vencido seguía pudiendo escribir si llamaba al SDK directamente,
porque las RLS solo validaban rol + tenant. Esto cierra ese hueco para comercializar la app.

- **Nuevo campo server-authoritative `write_access` (`enabled` | `blocked`) en `User`**
  (`rls.write: false`). Solo lo escribe `resolveTenant` con service role; el cliente no
  puede tocarlo.
- **`resolveTenant` calcula `write_access`** desde el estado de la licencia, con la misma
  política que `src/lib/license.js`: `enabled` mientras está `active` o en gracia
  `past_due` (1–7 días vencida); `blocked` al pasar a `readonly` (8–15 días),
  `disabled` (16+), `suspended` o `cancelled`. El owner de la app nunca se autobloquea.
- **RLS de `create` / `update` / `delete` endurecida en las 18 entidades operativas**
  (Vehicle, Driver, Trip, Maintenance, Part, Fine, FuelLog, InsuranceClaim, RentCharge,
  Alert, Message, Channel, DriverDocument, VehicleDocument, DriverPrivateNote,
  LocationRequest, Catalog, UsefulLink): ahora exigen
  `user_condition: { write_access: "enabled" }`. La **lectura no cambia** (la app queda
  en solo lectura). Un tenant vencido recibe error de RLS aunque le pegue al SDK.
- **Frontend:** `isWriteBlocked()` en `license.js` y `writeBlocked` en `TenantContext`;
  el contexto revalida tenant/licencia cada 15 min y al volver el foco a la pestaña, para
  que una sesión abierta que cruza la fecha de vencimiento no conserve permiso de escritura.
- **Tests:** +7 casos sobre el mapeo estado-de-licencia → bloqueo de escritura.

> Nota de frescura: `write_access` se recalcula cada vez que el cliente llama a
> `resolveTenant` (carga de la app + revalidación cada 15 min + al enfocar). Para que el
> corte sea totalmente independiente del cliente, conviene programar una ejecución diaria
> de `resolveTenant` (o una función equivalente) como tarea programada en el panel de Base44.

### Version

- `package.json` version `1.10.0` → `1.11.0`.

---

## [1.10.0] — 2026-06-16

### Added — Enlaces útiles (per-tenant external links)

- **New `UsefulLink` entity** (tenant-scoped): `label`, `url`, `description`, `active`,
  `sort_order`. Owner/admin manage; the whole tenant reads.
- **New "Enlaces útiles" page** (`/links`) in the main nav: each tenant's admin adds links
  to the external systems they use (e.g. their GPS, the fines portal), and any tenant user
  opens them in a new tab from inside the app. URLs are auto-normalized to `https://`.
  This replaces the idea of integrating those external apps — they stay separate, just
  linked. Read-only license hides the management controls.

### Version

- `package.json` version `1.9.1` → `1.10.0`.

---

## [1.9.1] — 2026-06-16

### Fixed

- **CSV Import created records without `tenant_id`** (same bug class as the original save
  bug) — imported drivers/vehicles would be rejected/orphaned by RLS. Now stamps
  `tenant_id`, supports `no_unidad` (unit number) for vehicles, removes the obsolete
  `vencimiento_medico` column, guards against read-only license / missing tenant, and
  reports partial failures instead of failing silently.

### Version

- `package.json` version `1.9.0` → `1.9.1`.

---

## [1.9.0] — 2026-06-16

### Added — granular permissions now enforced in the UI

- **`src/lib/modulePerms.js`** + `useModulePerms()`: the per-role/module/action config saved
  by the PermissionsPanel now actually gates the UI (owner/admin always full). Create/edit
  actions are blocked in Drivers, Vehicles, Maintenance, Parts and Financial when the
  tenant's config (or the role default) denies them. The entity RLS remains the hard
  backstop; this layer can only be equal or more restrictive.
- PermissionsPanel now shares the single `DEFAULT_PERMISSIONS` source and includes a
  **Rentas** module row. `TenantContext` exposes `userRole`.

### Added — referral bonus (business rule)

- **Rentas → Referidos** tab: lists each referrer and their referred drivers with on-time
  weekly-payment progress (X/4). When a referred driver reaches **4 on-time weekly
  payments** (paid by the collection day), an **Aplicar bono $1,000** action discounts the
  referrer's open charge and marks the bonus as paid (`Driver.referral_bonus_paid`),
  preventing double application.

### Added — more catalog wiring

- **Vehicle make** dropdown now offers tenant catalog suggestions (`vehicle_make`).

### Notes

- Non-referred "daily + advance" scheme is supported today with existing tools: set the
  unit's `rent_frequency = daily` and use **Cobro manual** to charge in advance.

### Version

- `package.json` version `1.8.0` → `1.9.0`.

---

## [1.8.0] — 2026-06-16

### Added — configurable catalogs (admin-defined, app-consumed)

- **New `Catalog` entity** (tenant-scoped): `category`, `label`, `active`, `sort_order`.
  Managed by owner/admin, readable by the whole tenant.
- **`useCatalog(category)` hook + `src/lib/catalogs.js`**: dropdowns read tenant catalog
  values, falling back to sensible defaults when none are defined yet (so the app works
  out of the box and the admin can override).
- **New Catálogos page** (`/catalogs`, owner/admin): create / activate / deactivate /
  delete values per category (fine types, payment methods, vehicle makes to start).
- **Wired dropdowns** to catalogs: fine types (FineForm) and payment methods (Rentas).

### Added — read-only enforcement (license)

- When the license is in **read-only** state, the primary write actions are blocked:
  Drivers, Vehicles, Rentas (generate/manual/pay), Financial, Maintenance and Parts hide
  their add/register buttons, and Drivers/Vehicles save handlers refuse writes with a
  clear message.

### Version

- `package.json` version `1.7.0` → `1.8.0`.

---

## [1.7.0] — 2026-06-16

### Added — SuperAdmin "Licencias" panel (app owner)

- **App owner identity** via `APP_OWNER_EMAIL` env var (default `h.josepablo@gmail.com`).
  `resolveTenant` now returns `is_app_owner`, surfaced through `TenantContext`.
- **New `licensesAdmin` edge function** — app-owner-only (the single legitimate
  cross-tenant exception, service-role): `list` all licenses, `renew` (confirm payment →
  extends `current_period_end` by month/year, sets `last_payment_at`, status active),
  `set_status` (active/suspended/cancelled/expired manual override). Per-tenant RLS stays
  intact for everyone else.
- **New `/licenses` page**, shown only to the app owner: all tenants with state badge,
  vigencia, admin email, member count; buttons **Confirmar pago mensual / Renovar anual**
  and a status override. Mercado Pago charges independently; this is the manual
  verify-and-renew flow.

### Version

- `package.json` version `1.6.0` → `1.7.0`.

---

## [1.6.0] — 2026-06-16

### Added — license lifecycle (iteration 1: client-facing gating)

- **License state machine** (`src/lib/license.js`): from `current_period_end` (or trial),
  computes `active → past_due (1–7 días vencidos) → readonly (8–15) → disabled (16+)`.
  `status: suspended|cancelled` forces immediate disable (owner override).
- **Free first month**: onboarding sets `current_period_end = hoy + 1 mes`.
- **Tenant banner** for upcoming/overdue payment, **read-only flag** exposed via
  `TenantContext`, and a full **"Acceso desactivado / Contacta a soporte"** screen at day 16.
- New `TenantLicense` fields: `current_period_end`, `billing_cycle`, `last_payment_at`.

### Pending (next iterations)

- SuperAdmin "Licencias" panel for the app owner (confirm payment / renew across tenants).
- Mercado Pago auto-billing integration.
- Per-form write-blocking while read-only.
- Configurable catalogs (no hardcoded dropdowns).
- Server-side enforcement of the granular PermissionsPanel.

### Version

- `package.json` version `1.5.0` → `1.6.0`.

---

## [1.5.0] — 2026-06-16

### Added — robust, server-side tenant assignment

- **New `resolveTenant` edge function.** Single source of truth for binding a user to
  their tenant. Runs with service role (no client-RLS chicken-and-egg): resolves the tenant
  by `created_by` → `owner_email` → `members[]`, persists `tenant_id` on the profile, and
  on an invited user's **first** login applies the role recorded in `members[]` (later role
  changes stay with the tenant admin). Scales to many tenants.
- **`TenantContext` now calls `resolveTenant`** as the primary path, with client-side
  discovery only as a fallback. Removed the unsafe `all[0]` fallback that, under
  multi-tenancy, could bind a user to the wrong tenant.

### Version

- `package.json` version `1.4.0` → `1.5.0`.

---

## [1.4.0] — 2026-06-16

### Security — multi-tenant isolation hardening (before first real tenant onboards)

- **[HIGH] `TenantLicense` cross-tenant read fixed.** Any `admin` could previously read
  **every** tenant's license (incl. `members[]` emails/names, `owner_email`, `notes`).
  Read is now scoped to tenants you created (`created_by_id`), own (`owner_email`), or
  are a member of (`members.email`). Removed the blanket `role: admin reads all` rule.
- **[HIGH] `TenantLicense` cross-tenant write fixed.** Any `admin`/`owner` could previously
  **update any** tenant's license (suspend it, change its plan, raise its own limits).
  Update now requires you to belong to that tenant (creator / owner_email / member with
  owner|admin role).
- **[HIGH] `User` cross-tenant access fixed.** Removed the global `role: owner` branches
  that let a tenant owner read/update **all** platform users. User read/update are now
  scoped to the same `tenant_id` (own record always allowed).
- **Invited users are now bound to their tenant.** Inviting a user records them in the
  tenant's `members[]`, which is what ties them to the tenant (drives the `members.email`
  RLS and reliable tenant discovery on first login — previously discovery fell back to
  "first tenant", which is wrong under multi-tenancy).
- **Dev/integration functions locked to `owner`.** `supabaseData`, `githubRepos`, and
  `createTestData` were callable by any `admin` of any tenant (service-role access to the
  connected Supabase/GitHub, or test-data writes). Now owner-only. The GitHub/Supabase
  pages are owner-only too. `createTestData` no longer falls back to another tenant when
  the caller has no tenant.

### Version

- `package.json` version `1.3.0` → `1.4.0`.

---

## [1.3.0] — 2026-06-16

### Added

- **Rentas → vista de Ingresos**: nuevo reporte de pagos recibidos. En modo **Día**
  muestra cuánto entró y **de quién** (cada pago: conductor, unidad, método, monto); en
  modo **Semana** muestra el total, el ingreso por conductor y **quién quedó debiendo y
  cuánto**. Resuelve la necesidad de ver ingreso diario (varios choferes pagan diario) vs.
  ingreso semanal con adeudos.
- **Conductores → Referido**: campo **"Referido por (conductor)"** en el formulario y badge
  **Referido** en lista y expediente. (La automatización del bono de $1,000 — al cumplir el
  referido sus pagos puntuales, descontándolo de la renta del que refiere — queda como
  siguiente paso.)
- **Día de cobro por unidad** (`Vehicle.rent_day`): la renta semanal se cobra en distintos
  días según la unidad; el generador de cobros ancla la semana al día de cada unidad.

### Changed

- **Placa ahora opcional**: el identificador operativo es el **No. de unidad** (U01, U02…).
  Las vistas usan la unidad como respaldo cuando no hay placa.

### Data Model

- `Vehicle`: `rent_day` added; `plate` no longer required.

### Version

- `package.json` version `1.2.0` → `1.3.0`.

---

## [1.2.0] — 2026-06-16

### Added — Rentas model (core business)

The fleet rents units to drivers (not trip dispatch). This release adds rent tracking
with **partial payments** and **per-driver outstanding balances** — the operator's main
pain point ("se me junta el saldo negativo cuando no pagan completo").

- **Per-unit tariff** on `Vehicle`: `rent_amount` and `rent_frequency` (`weekly` default,
  `daily`). Tariff and frequency vary per unit, as in the real operation.
- **New `RentCharge` entity** — one charge per period per unit: `amount_due`,
  `amount_paid`, `status` (pending/partial/paid), and a `payments[]` history (amount,
  date, method, note). Tenant-scoped RLS (owner/admin/dispatcher manage; drivers can read
  their own).
- **New Rentas page** (`/rentas`):
  - KPIs: **Cobrado hoy**, **Por cobrar**, **Choferes con adeudo**.
  - **Saldo pendiente por conductor** — accumulates partial shortfalls into a running
    balance per driver.
  - **Generar cobros del periodo** — creates the current week/day charge for each active
    unit with a tariff and an assigned driver (skips duplicates).
  - **Registrar pago** — supports partial payments; updates balance and status.
  - **Cobro manual** — ad-hoc charge for advance/daily collection.
  - Filters: pendientes / parciales / vencidos / pagados; search by unit or driver.
- **Driver `referred_by_driver_id`** — captures the referral relationship (referral-bonus
  automation is a follow-up; rules still being defined).
- **Dashboard** now reflects rentas: **Ingresos hoy = rentas cobradas**, plus **Por
  cobrar** and **Disponibilidad operativa** (`activos / total`).
- **Financiero**: removed the **Combustible** tab (no aplica — the driver pays fuel).

### Data Model

- `Vehicle`: added `rent_amount`, `rent_frequency`.
- `Driver`: added `referred_by_driver_id`.
- New entity `RentCharge`.

### Version

- `package.json` version `1.1.0` → `1.2.0`.

---

## [1.1.0] — 2026-06-16

### Fixed

- **[HIGH] Drivers/Vehicles save hangs and does not persist.** Root cause: entity RLS
  requires `data.tenant_id == user.data.tenant_id`, but the user's `tenant_id` was
  persisted via a fire-and-forget `updateMe()` that was not awaited and swallowed
  errors, so a freshly-onboarded user could save before their profile had the tenant.
  `TenantContext` now awaits `updateMe`, and `TenantOnboarding` sets `tenant_id`
  immediately after creating the license. `DriverForm`/`VehicleForm` now use
  `try/catch`, always reset the saving state, and surface a clear inline error instead
  of spinning on "Guardando..." forever. `Drivers`/`Vehicles` guard `create` when the
  tenant is not ready yet.

### Changed (client feedback — quick wins)

- **Conductores:** removed *Certificado médico* (no aplica). Added per-driver document
  uploads: **Licencia, INE, Comprobante de domicilio** (each a separate file field,
  image or PDF), shown in the driver form and file detail.
- **Vehículos:** added **No. de unidad** and **Vencimiento de holograma** fields
  (form, detail, and list). Hologram expiry now feeds the automatic alert generation.
- **Inventario:** added **Marca** and **No. de unidad** to parts.
- **Dashboard:** removed *Viajes hoy* and *Rating promedio* cards (no aplican).
  "Ingresos hoy" relabelled toward rentas (to be wired to the rentas model next).

### Data Model

- `Driver`: removed `medical_cert_expiry`; added `license_file_url`, `ine_file_url`,
  `address_proof_file_url`.
- `Vehicle`: added `unit_number`, `hologram_expiry`.
- `Part`: added `brand`, `unit_number`.

### Version

- `package.json` version `1.0.2` → `1.1.0`.

---

## [1.0.2] — 2026-06-15

### Security

- **[LOW] Fixed Messages page: Channel.list() missing tenant_id filter**: `Channel.list()` had no tenant filter in `Messages.jsx`, inconsistent with the defense-in-depth approach applied to Dashboard (v1.0.1) and Layout (v1.0.0). Changed to `Channel.filter({ tenant_id: tenantId })`. Entity-level RLS was already enforcing isolation, but explicit client-side filtering was absent.
- **[LOW] Fixed Messages page: Message.create() missing tenant_id**: Both text and voice message creation calls lacked an explicit `tenant_id` field. Added `tenant_id: tenantId` to both `Message.create()` calls for defense-in-depth. Entity RLS already scoped writes to the tenant.

### Quality

- **Fixed tenant reload reactivity in Financial, Drivers, Vehicles pages**: `useEffect` hooks in `Financial.jsx`, `Drivers.jsx`, and `Vehicles.jsx` did not list `tenantId` as a dependency, meaning data would not reload if the tenant context changed after initial render. Added `tenantId` to all three dependency arrays.
- ESLint passes with 0 errors.

### Version

- `package.json` version `1.0.1` → `1.0.2`.

---

## [1.0.1] — 2026-06-08

### Security

- **[MEDIUM] Fixed missing tenant filter in Dashboard unread-messages query**: `Message.filter({ read: false })` lacked a `tenant_id` filter. Added `{ read: false, tenant_id: tenantId }` for defense-in-depth tenant isolation (entity-level RLS was already in place).
- **[LOW] Fixed Admin users list exposed all platform users to owner role**: `User.list()` in `Admin.jsx` was called without a tenant scope. For the `admin` role the existing User RLS already restricted to same-tenant users; for the `owner` role it could return all platform users. Changed to `User.filter({ 'data.tenant_id': tenantId })` to scope the Admin page user list to the current tenant regardless of role.

### Quality

- **Updated SDK version in all Deno edge functions**: All five server-side functions (`generateAlerts`, `calculateCostPerKm`, `createTestData`, `githubRepos`, `supabaseData`) were pinned to `npm:@base44/sdk@0.8.25` while the project moved to `^0.8.31`. Updated all imports to `@0.8.31` to align server-side and client-side SDK versions.
- ESLint passes with 0 errors.

### Version

- `package.json` version `1.0.0` → `1.0.1`.

---

## [1.0.0] — 2026-06-02

### Security

- **[HIGH] Fixed cross-tenant document exposure in alert generation** (`generateAlerts` function): `DriverDocument.list()` and `VehicleDocument.list()` previously ran via service-role with no tenant filter, making every tenant's documents accessible to the alert function of any other tenant. Fixed by adding `{ tenant_id: tenantId }` filter to both queries.
- **[HIGH] Added role guard to `calculateCostPerKm` function**: Any authenticated user (including drivers) could previously call the fleet financial analysis endpoint. Now restricted to `owner`, `admin`, and `dispatcher` roles only.
- **[HIGH] Added Row-Level Security (RLS) to User entity**: The User entity had no access controls. Added RLS rules so users can only read others in the same tenant, owners see all, and only admins/owners can update user records.

### Features

- **PermissionsPanel — permissions now persist to backend**: The "Guardar cambios" button was previously cosmetic (permissions reset on every page reload). Permissions are now saved to `TenantLicense.permissions_config` and reloaded when the admin page opens.
- **Admin role locked as non-editable in PermissionsPanel**: Admin always has full access to all modules and is no longer displayed as an editable role tab. Dispatcher, Mechanic, and Driver are the configurable roles.
- **Defense-in-depth tenant filtering in Layout**: Alert and message badge queries now include explicit `tenant_id` filter in addition to the RLS enforcement already in place.

### Quality

- Removed 14 unused imports across Layout, SuperAdminPanel, DriverDetail, Admin, Billing, Drivers, GitHubPage, Import, MaintenancePage, TestData, DriverHome, DriverTrips.
- ESLint now passes with 0 errors.

### Data Model

- Added `permissions_config` (object) field to `TenantLicense` entity for storing per-tenant role permission settings.

### Version

- `package.json` version `0.0.0` → `1.0.0`.

---

## Pre-1.0 — Base44 builder history (summary)

The following modules were built and iteratively improved via the Base44 AI builder prior to formal version tracking:

- **Dashboard**: fleet status, KPI cards, alert/message badges, today's trips and earnings.
- **Drivers**: driver catalog with search, status, rating, photo, detail view, and driver-app linking.
- **Vehicles**: vehicle catalog with plate, make, model, year, odometer, and driver assignment.
- **Maintenance / Parts**: maintenance records, scheduled service, parts inventory.
- **Financial**: fuel logs, fines/infractions, insurance claims, cost-per-km calculation.
- **Alerts**: automatic alert generation for expiring documents, insurance, inspections, maintenance due dates.
- **Messages**: channel-based messaging with real-time updates and voice message support.
- **Location**: on-demand location request/response system (no continuous tracking).
- **Driver App**: driver-specific views for home, trips, and profile.
- **Admin**: tenant management, user invite, role assignment, danger zone, SuperAdmin panel.
- **Billing**: license/plan display, usage metrics, members list.
- **Import**: CSV import utilities.
- **Onboarding**: tenant creation flow for new admins.
- Multi-tenant architecture via `TenantLicense` entity and per-entity RLS rules.
- Role model: `owner`, `admin`, `dispatcher`, `mechanic`, `driver`.
