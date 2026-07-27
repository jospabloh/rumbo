# Rumbo — Granular Roles and Permissions Matrix

**Version 1.29.1 | Updated 2026-07-27**

---

## Roles

| Role | Description | Tenant-Scoped |
|------|-------------|---------------|
| `owner` | Platform owner; full access + license management | Yes (own tenant only) |
| `admin` | Tenant administrator; full operational access | Yes |
| `dispatcher` | Fleet operator; configurable access | Yes |
| `mechanic` | Workshop technician; configurable access | Yes |
| `driver` | Driver; limited personal data access | Yes |

---

## Page / Route Access

All pages except the driver portal and help are protected by `RequireAccess` (which applies `can(role, page)` at the route level) or `RequireAppOwner` for platform-owner-only pages. Sidebar nav is additionally filtered by `can()`. As of v1.18.0, direct URL navigation to a restricted page shows an "Acceso restringido" screen — it is no longer silently accessible by URL.

| Page | owner | admin | dispatcher | mechanic | driver | Enforcement |
|------|-------|-------|-----------|---------|--------|-------------|
| Dashboard (`/`) | ✅ | ✅ | ✅ | ❌ | ❌ | `RequireAccess page="dashboard"` + `permissions.js` `can()` |
| Drivers (`/drivers`) | ✅ | ✅ | ✅ | ❌ | ❌ | `RequireAccess page="drivers"` |
| Vehicles (`/vehicles`) | ✅ | ✅ | ✅ | ✅ | ❌ | `RequireAccess page="vehicles"` |
| Rentas (`/rentas`) | ✅ | ✅ | ✅ | ❌ | ❌ | `RequireAccess page="rentas"` + `RentCharge` RLS |
| Maintenance (`/maintenance`) | ✅ | ✅ | ❌ | ✅ | ❌ | `RequireAccess page="maintenance"` |
| Parts/Inventory (embedded in `/maintenance`) | ✅ | ✅ | ❌ | ✅ | ❌ | Same as maintenance |
| Financial (`/financial`) | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="financial"` |
| Reportes (`/reports`) | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="reports"` + `fleetUnitMetrics` server function (owner/admin only) |
| Expenses (`/expenses`) | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="expenses"` + `Expense.jsonc` RLS |
| Alerts (`/alerts`) | ✅ | ✅ | ✅ | ❌ | ❌ | `RequireAccess page="alerts"` |
| Location (`/location`) | ✅ | ✅ | ✅ | ❌ | ❌ | `RequireAccess page="location"` |
| Messages (`/messages`) | ✅ | ✅ | ✅ | ❌ | ❌ | `RequireAccess page="messages"` |
| Import (`/import`) | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="import"` |
| Billing (`/billing`) | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="billing"` |
| Admin (`/admin`) | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="admin"` |
| Catalogs (`/catalogs`) | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="catalogs"` |
| Links/Útiles (`/links`) | ✅ | ✅ | ✅ | ✅ | ❌ | `RequireAccess page="links"` |
| Help/Centro de ayuda (`/help`) | ✅ | ✅ | ✅ | ✅ | ✅ | `RequireAccess page="help"` (all authenticated roles) |
| Driver Home (`/driver/home`) | — | — | — | — | ✅ | `RequireAccess roles={['driver']}` |
| Driver Trips (`/driver/trips`) | — | — | — | — | ✅ | `RequireAccess roles={['driver']}` |
| Driver Profile (`/driver/profile`) | — | — | — | — | ✅ | `RequireAccess roles={['driver']}` |
| Driver Messages (`/driver/messages`) | — | — | — | — | ✅ | `RequireAccess roles={['driver']}` |
| GitHub (`/github`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` (gated on `APP_OWNER_EMAIL`) |
| Supabase (`/supabase`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` |
| Licenses (`/licenses`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` |
| Support Tickets (`/tickets`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` |
| Test Data (`/test-data`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` |

**Page protection enforcement (v1.18.0+):** `RequireAccess` (`src/components/RequireAccess.jsx`) applies the same `can(role, page)` logic at route render time. A user who navigates directly to a restricted URL sees a "Acceso restringido" screen. Backend/entity RLS provides the data-level protection regardless.

---

## Granular Module Permissions (PermissionsPanel — Admin-Configurable)

The following matrix shows **default values** for configurable roles. Admin explicitly grants/revokes these per tenant via the Permisos por Rol panel in Admin. Changes are persisted to `TenantLicense.permissions_config` and used to control UI-level access per module.

**Note (G1):** These granular permissions currently control the UI only (what the user sees). Backend entity RLS enforces the role-level access (e.g., a dispatcher cannot call the Vehicle API if the entity RLS disallows it), but does not yet read `permissions_config`. New modules default to view-only for non-admin roles.

### Default: Dispatcher

| Module | View | Create | Edit | Delete | Pause | Enforced in Backend |
|--------|------|--------|------|--------|-------|---------------------|
| Vehicles | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Drivers | ✅ | ✅ | ✅ | ❌ | ✅ | Entity RLS |
| Rentas | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Trips | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Maintenance | ✅ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Parts/Inventory | ❌ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Fuel | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Fines | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Insurance | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Alerts | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Messages | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Location | ✅ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Financial | ❌ | ❌ | ❌ | ❌ | ❌ | Page-level guard (`RequireAccess`) |
| Reports/Import | ❌ | ❌ | ❌ | ❌ | ❌ | Page-level guard (`RequireAccess`) |

### Default: Mechanic

| Module | View | Create | Edit | Delete | Pause | Enforced in Backend |
|--------|------|--------|------|--------|-------|---------------------|
| Vehicles | ✅ | ❌ | ✅ | ❌ | ✅ | Entity RLS |
| Drivers | ❌ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Trips | ❌ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Maintenance | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Parts/Inventory | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| All others | ❌ | ❌ | ❌ | ❌ | ❌ | Entity RLS |

### Default: Driver

| Module | View | Create | Edit | Delete | Pause | Enforced in Backend |
|--------|------|--------|------|--------|-------|---------------------|
| Vehicles | ✅ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Drivers (own) | ✅ | ❌ | ✅ | ❌ | ❌ | Entity RLS |
| Trips | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Fuel | ✅ | ✅ | ❌ | ❌ | ❌ | Entity RLS |
| Fines | ✅ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Insurance | ✅ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Alerts (own) | ✅ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Messages | ✅ | ✅ | ❌ | ❌ | ❌ | Entity RLS |
| All others | ❌ | ❌ | ❌ | ❌ | ❌ | Entity RLS |

### Admin (Always All True — Not Configurable)

Admin has full view, create, edit, delete access to every module within their tenant. Admin permissions are not stored in `permissions_config` and are not editable in the PermissionsPanel.

---

## Specific Actions and Guards

| Action | Required Role | Enforcement Location | Notes |
|--------|--------------|---------------------|-------|
| Invite user | admin, owner | `Admin.jsx` client check | `base44.users.inviteUser()` |
| Change user role | admin, owner | `Admin.jsx` client check + `User.jsonc` RLS | Cannot change own role |
| Suspend / reactivate user | admin, owner | `manageMember` server function | `write_access` + `suspended` are server-authoritative |
| Remove user from tenant | admin, owner | `manageMember` server function | Unlinks from tenant; does not delete account |
| Delete tenant | admin, owner | `Admin.jsx` DangerZone | Requires typing "ELIMINAR" |
| Delegate tenant ownership | admin, owner | `Admin.jsx` DangerZone | Updates `owner_email` |
| Generate alerts | admin, owner | `generateAlerts` server function | 403 for other roles |
| Calculate cost-per-km | admin, owner, dispatcher | `calculateCostPerKm` server function | 403 for driver/mechanic |
| Fleet unit metrics (utilidad/ranking/pronóstico) | admin, owner | `fleetUnitMetrics` server function | 403 for dispatcher/mechanic/driver — surfaces `Expense`/revenue data, stricter than cost-per-km |
| Rent balance carryover | admin, owner, dispatcher | `Rentas.jsx` `generatePeriodCharges` client logic + `RentCharge`/`Alert` RLS | Rolls a unit's unpaid rent into the next period's charge; raises an `Alert` (`entity_type: 'rent_balance'`) |
| Submit support ticket | any authenticated tenant user | `submitTicket` server function | Creates SupportTicket + sends email confirmation; runs with service role so write-blocked tenants can still submit |
| View/manage all support tickets | app owner only | `ticketsAdmin` server function + `/tickets` page (`RequireAppOwner`) | Cross-tenant; gated on `APP_OWNER_EMAIL` |
| View all tenants (SuperAdmin) | app owner only | `Admin.jsx` `isOwner()` check | SuperAdminPanel visible only to owner |
| Manage license plan/status | app owner only | `licensesAdmin` server function + `SuperAdminPanel.jsx` | Gated on `APP_OWNER_EMAIL` |
| View Billing page | admin, owner | `RequireAccess page="billing"` | Access denied shown for others |
| View Admin page | admin, owner | `RequireAccess page="admin"` | Access denied shown for others |
| Manage catalogs | admin, owner | `RequireAccess page="catalogs"` + `Catalog.jsonc` RLS | Entity RLS enforces owner/admin create/update/delete |
| Manage useful links | admin, owner | `UsefulLink.jsonc` RLS | Entity RLS; `/links` page visible to dispatcher and mechanic (read) |
| View Supabase/GitHub/TestData | app owner only | `RequireAppOwner` + server functions gated on `APP_OWNER_EMAIL` | Platform-level admin tools |
| ACACIA Mission Control bridge | no in-app user (external platform-ops caller) | `acaciaControl` server function — HMAC-signature-gated (`INGEST_HMAC_SECRET`), not tied to any app role/session | Not user-facing; see "ACACIA Mission Control bridge" section below |
| View Help / Centro de ayuda | all roles | `RequireAccess page="help"` | Manual guide and support ticket form accessible to all |
| In-app manual search | all roles | `Help.jsx` + `ManualGuide.jsx` | `src/lib/manual.js` — 19 sections, tenant-neutral content |

---

## Backend / Entity RLS Summary

> **License write-gate (v1.11.0):** every operational entity below additionally requires
> `user_condition: { write_access: "enabled" }` on **create / update / delete**. `write_access`
> is server-set by `resolveTenant` from the license state (`blocked` when `readonly`/`disabled`/
> `suspended`/`cancelled`). Read is never gated by it — an expired tenant keeps read-only access.

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| TenantLicense | owner only | creator / owner_email / member | owner_email, or (own bound tenant + member + owner/admin)¹ | creator / owner_email |
| User | owner/admin (via server fn) | own record / same tenant_id (owner,admin) | own record / same-tenant owner,admin | same-tenant owner,admin |
| Vehicle | owner, admin, dispatcher | same tenant_id | owner, admin, dispatcher | owner, admin |
| Driver | owner, admin, dispatcher | same tenant_id | owner, admin, dispatcher (entity-level); self (`profile_id`) limited to `phone` only, field-level² | owner, admin |
| Trip | (per RLS) | same tenant_id | (per RLS) | owner, admin |
| RentCharge | owner, admin, dispatcher | same tenant_id + role or own driver_id | owner, admin, dispatcher | owner, admin |
| Alert | owner, admin, dispatcher | same tenant_id + role or own driver_id | owner, admin, dispatcher | owner, admin |
| Message | sender (tenant-scoped) | same tenant_id + (role / own sender_id / broadcast channel / own driver channel) | creator / owner, admin, dispatcher | owner, admin |
| Channel | owner, admin, dispatcher | same tenant_id + role, broadcast, or own driver_id | owner, admin, dispatcher | owner, admin |
| FuelLog | (per entity RLS) | same tenant_id | (per RLS) | owner, admin |
| Fine | (per entity RLS) | same tenant_id | (per RLS) | owner, admin |
| InsuranceClaim | (per entity RLS) | same tenant_id | (per RLS) | owner, admin |
| Maintenance | owner, admin, mechanic | same tenant_id | owner, admin, mechanic | owner, admin |
| Part | owner, admin, mechanic | same tenant_id | owner, admin, mechanic | owner, admin |
| DriverDocument | owner, admin, dispatcher | same tenant_id + role or own driver_id | owner, admin, dispatcher | owner, admin |
| DriverPrivateNote | owner, admin | same tenant_id | owner, admin | owner, admin |
| VehicleDocument | owner, admin, dispatcher | same tenant_id | owner, admin, dispatcher | owner, admin |
| LocationRequest | owner, admin, dispatcher | same tenant_id + role/driver/requester | owner, admin, dispatcher, own driver | owner, admin |
| Catalog | owner, admin | same tenant_id | owner, admin | owner, admin |
| UsefulLink | owner, admin | same tenant_id | owner, admin | owner, admin |
| SupportTicket | any tenant user (via `submitTicket` server fn) | own tenant (admin/owner) or own ticket (requester_id) | owner, admin | owner, admin |

¹ **Fixed v1.29.0 (A33):** the member+role update branch now also requires the record's own `id` to equal the caller's bound `data.tenant_id` — closes a cross-tenant escalation where a user who is owner/admin of their own tenant, but also listed in another tenant's `members[]`, could update that other tenant's license via a direct API call.
² **Fixed v1.29.0 (A34):** `full_name`, `license_no`, `license_expiry`, `background_check_date`, `rating`, `status`, `hire_date`, `photo_url`, license/INE/address-proof files, `referred_by_driver_id`, `referral_bonus_paid`, `referral_credit`, `profile_id`, `aval_name` are now field-level restricted to owner/admin/dispatcher; `ticket_number`/`requester_id`/`requester_email`/`tenant_name` on `SupportTicket` are now `write:false` (server-authoritative via `submitTicket`).
| Expense | owner, admin (write-gated by `write_access`) | same tenant_id (owner, admin) | owner, admin (write-gated) | owner, admin (write-gated) |
| AppSession | any authenticated user (own row via `created_by_id`) | own row or service-role admin | own row or service-role admin | service-role admin only |
| DashboardUnitPref | own row (`created_by_id`, tenant-scoped) | own row only | own row only | own row only |
| UnitDayNote | owner, admin, dispatcher (write-gated) | same tenant_id (+ mechanic read) | owner, admin (write-gated) | owner, admin (write-gated) |
| AcaciaReplayKey | service role only | service role only | service role only | service role only | Anti-replay nonce store for `acaciaControl`; no tenant_id (not tenant data), no app user (owner/admin/etc.) can read/write it — see below |

---

## ACACIA Mission Control Bridge (Platform-Ops, Not User-Facing)

`base44/functions/acaciaControl/entry.ts` is a separate admin channel used by the external
ACACIA Mission Control system to manage this app's tenants (license sync, usage counts,
support-ticket handling, session revocation). It is **not part of the in-app role/permission
model** — it has no user session at all — and is deliberately excluded from `USER_MANUAL.md`
since it is never seen or used by tenant users or admins.

- **Auth:** HMAC-SHA256 signature over `{ts}.{action}.{stableStringify(params)}`, verified
  against the `INGEST_HMAC_SECRET` app secret (`Deno.env.get`, never hardcoded) with a
  timing-safe comparison. No app user token is involved.
- **Anti-replay:** every verified request's signature (+ optional `nonce`/`jti`) is checked
  against, then persisted to, the `AcaciaReplayKey` entity (service-role-only RLS — no app
  role can read or write it) so a captured signed request can't be re-sent within the clock-skew
  window. Stale keys are pruned on each call.
- **Entity allowlist (defense-in-depth):** even with a valid signature, the function only
  ever touches `TenantLicense`, `SupportTicket`, and `AppSession` (`ALLOWED_ENTITIES`) via
  `params.entity` — an arbitrary or built-in entity name (e.g. `User`) is rejected with 403.
  This bounds the blast radius of a leaked/guessed secret to those three entities instead of
  unrestricted service-role access to the whole multi-tenant database.
- **Email-relay guard:** `emails.sendFollowup` validates the recipient against an email regex
  and caps subject/body size before calling `SendEmail`, so the bridge can't become an open
  phishing relay even when correctly authenticated.
- Tenant isolation is not applicable in the usual sense — this is a cross-tenant platform-ops
  tool by design (same category as `licensesAdmin`/`ticketsAdmin`), gated on a secret instead
  of `APP_OWNER_EMAIL` because the caller has no app user at all.

---

## Known Gaps and Accepted Risks

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| G1 | Granular PermissionsPanel permissions are saved to `TenantLicense.permissions_config` but enforced only in the UI — not at the API/entity RLS level | MEDIUM | **Documented — enforcement at data layer is a future priority; entity RLS still enforces role-level access (e.g., dispatchers can't call Maintenance entity APIs)** |
| G2 | ~~Page protection is client-side only~~ | ~~LOW~~ | **FIXED v1.18.0 — `RequireAccess` component enforces `can(role, page)` at route render time; direct URL navigation shows access-denied screen** |
| G3 | `TenantLicense` read RLS allowed any `admin` to read all TenantLicenses — cross-tenant license/PII exposure | ~~LOW~~ | **FIXED v1.4.0 — read scoped to creator / owner_email / members.email; invites now populate members[]** |
| G4 | New users invited but not yet logged in lack `tenant_id` in their profile — they may not appear in tenant user lists immediately | LOW | **Accepted — resolves automatically on first login via `resolveTenant`** |
| G5 | License lapse (`readonly`/`disabled`) was enforced **client-side only** — an expired tenant could still write via the SDK directly | ~~MEDIUM~~ | **FIXED v1.11.0 — server-authoritative `User.write_access` (set by `resolveTenant`) + `user_condition: { write_access: "enabled" }` on create/update/delete RLS of all operational entities. Reads stay allowed (read-only). Freshness: recomputed on each `resolveTenant` call (app load + 15-min revalidation + focus).** |

---

## Audit History

### v1.29.1 Audit (2026-07-27)

Security, code quality, tenant-isolation, permissions, and release-readiness audit covering all changes since v1.29.0 (a `@base44/sdk` package bump and a `.gitignore`/`base44/.app.jsonc` housekeeping commit — no application code changed).

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A41 | SDK version drift recurrence: frontend `@base44/sdk` moved to `^0.8.40` (via an unreleased "Update base44 packages" commit) while all 14 backend Deno functions remained pinned to `@0.8.37`. Same root cause as A35/F3 — a frontend-only SDK bump not mirrored to backend functions. | LOW/MEDIUM | **FIXED — all 14 functions re-pinned to `@0.8.40`** |
| A42 | Permissions matrix documentation gap: the `AcaciaReplayKey` entity and `acaciaControl` server function (ACACIA Mission Control admin bridge — HMAC-signature-gated, entity-allowlisted, service-role-only) existed in the codebase but were not documented in this matrix. Code review found the implementation itself sound (timing-safe HMAC check, persistent anti-replay store, entity allowlist, email-relay validation, secret read only via `Deno.env.get` — no hardcoded credential). | LOW | **FIXED — documented in "ACACIA Mission Control Bridge" section, RLS summary, and Files Implementing Permissions table** |
| A43 | `npm audit`: 10 dependency vulnerabilities found (1 low, 5 moderate, 3 high, 1 critical) at HEAD before this audit. Split by production exposure: `postcss` (high, path-traversal in sourcemap loading — build-time only), `dompurify` (low, custom-element sanitize bypass) and `brace-expansion` (high, ReDoS) were all transitive dev/build-tool dependencies with non-breaking patch fixes available. | LOW/HIGH (dev-only) | **FIXED — `npm audit fix` applied (postcss→8.5.23, dompurify→3.4.12, brace-expansion→1.1.16), no `package.json` range changes** |
| A44 | `npm audit --omit=dev` (production-only tree) after A43's fix: `react-router`/`react-router-dom` (moderate) — open redirect via backslash in `<Link>`/`useNavigate`, and an SSR-hydration constructor-injection issue. Fix requires a v6→v7 major bump (breaking). Verified no exploitable path in this app: grepped every `navigate(...)`/`<Link to={...}>` call site — none construct a target from URL query params, `location.search`, or other externally-controlled input; the one dynamic case (`FleetProfitMatrixCard.jsx`) builds an internal `/reports` path from the record's own `vehicleId`/date. The SSR-hydration advisory doesn't apply — this app is client-side-rendered only (Vite SPA, no SSR). | MODERATE | **Accepted risk — no exploitable path found; major-version bump deferred as out of scope for an automated pass (would need full route-by-route regression testing)** |
| A45 | Remaining `npm audit` findings (`vitest`/`@vitest/mocker`/`vite`/`vite-node`/`esbuild`/`eslint`/`eslint-plugin-react`/`minimatch`/`@eslint/*`) confirmed dev-only via `npm audit --omit=dev` (zero results beyond A44) — build/lint/test tooling, never shipped to production. Same lineage as A17 (unchanged since v1.24.0); fixing requires breaking `vitest@4`/`eslint@10` upgrades. | LOW (dev-only) | **Accepted risk — reconfirmed no production exposure** |
| A46 | Re-confirmed clean: no hardcoded secrets/API keys/tokens/credentials (including in `acaciaControl`'s HMAC handling); `resolveTenant` tenant-binding fallback (no `all[0]` risk); `generateAlerts`/`calculateCostPerKm`/`fleetUnitMetrics` tenant scoping and role gating; Admin users list tenant filtering; route/page protection backed by independent server-side/RLS enforcement. `validate:rls` (26 entities, including `AcaciaReplayKey`), `audit:tenant-scope`, lint, typecheck, all 440 unit tests, and the production build all pass at HEAD. | — | **CONFIRMED CLEAN / CONFIRMED PASSING** |

**No open, draft, or disconnected pull requests found** at audit start — the prior audit (PR #83) was cleanly merged, and no work-in-progress branches existed. No unresolved GitHub issues. CI green on `main` at HEAD.

---

### v1.29.0 Audit (2026-07-13)

Security, code quality, tenant-isolation, permissions, and release-readiness audit covering all changes since v1.26.0 (v1.27.0 Reportes/fleet-metrics dashboard, v1.28.0 bitácora/aval/insurer/maintenance-reserve fields, and the unreleased FuelLog RLS fix/base44 package bump that landed on `main` without a version bump).

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A33 | `TenantLicense.update`: member+role branch checked the caller's *global* role but not whether the target record was the tenant they're actually bound to — a user who is owner/admin of their own tenant, also listed in a different tenant's `members[]`, could update that other tenant's license via a direct API call (billing plan, `permissions_config`, `join_code`, `members`), bypassing the UI entirely. | HIGH | **FIXED — added `id == {{user.data.tenant_id}}` guard; deployed live and verified via `list_entity_schemas`** |
| A34 | `Driver` entity: no field-level write protection — a self-linked driver (`profile_id` match) could write any field via the entity-level update rule, though the app only ever lets them edit `phone` (`DriverProfile.jsx`). Real risk: masking an expired license from `generateAlerts`, inflating own `rating`, editing referral-bonus fields. `SupportTicket`: `ticket_number`/`requester_id`/`requester_email`/`tenant_name` had no field lock despite being meant as server-authoritative (set by `submitTicket`). | MEDIUM / LOW | **FIXED — field-level `write` restricted to owner/admin/dispatcher on `Driver` (phone stays self-editable); `write:false` on the four `SupportTicket` fields; deployed live and verified** |
| A35 | SDK version drift recurrence: frontend `@base44/sdk@^0.8.37` vs. all 14 backend Deno functions pinned to `@0.8.31` (previously fixed in v1.0.1/`F3`, drifted again after subsequent frontend-only SDK bumps). | LOW/MEDIUM | **FIXED — all 14 functions re-pinned to `@0.8.37`** |
| A36 | `PermissionsPanel` save persisted to `TenantLicense.permissions_config` correctly but never refreshed shared `TenantContext`, leaving stale permissions visible elsewhere in the app until the next 15-min revalidation. | LOW | **FIXED — calls `reload()` after save, matching the existing `BusinessSettingsPanel` pattern** |
| A37 | `DangerZone` "Delegar ownership" accepted any typed email with no check it belonged to an existing tenant member, and had no error handling on failed save/delete. | LOW | **FIXED — validates target against `tenant.members[]` before enabling the action; both delegate and delete now surface save errors** |
| A38 | `resolveTenant`/`TenantContext` fallback logic: confirmed no `all[0]`-style fallback in either the server function or the client's degraded-mode discovery path; `tenant_id`/`role`(post-bind)/`driver_profile_id`/`write_access` all server-authoritative (`write:false`) on `User`. | — | **CONFIRMED CLEAN** |
| A39 | `generateAlerts` and `calculateCostPerKm`: tenant scoping via `user.data.tenant_id` only (never client-supplied), correct role gates (admin/owner; owner/admin/dispatcher respectively). Admin users list (`Admin.jsx`) filtered by `data.tenant_id`, backed by `User.jsonc` read RLS independently. Route/page protection (`RequireAccess`/`RequireAppOwner`) backed by independent server-side checks (role-gated functions, entity RLS) — not UI-hiding alone. | — | **CONFIRMED CLEAN** |
| A40 | No hardcoded secrets, API keys, tokens, or credentials found. `validate:rls` (26 entities), `audit:tenant-scope`, lint, typecheck, all 440 unit tests, and the production build all pass at HEAD. 5 dev-only `vite`/`vitest`/`esbuild` transitive vulnerabilities re-confirmed as accepted risk (unchanged since v1.24.0/`A17` — no production exposure, fix requires breaking `vitest@4` upgrade). | — | **CONFIRMED CLEAN / CONFIRMED PASSING** |

**Known, not independently re-verified this pass:** the granular `PermissionsPanel`/`permissions_config` UI-only enforcement gap (**G1**, unchanged) and the broad `TenantLicense.read` exposure to any listed `members[]` entry regardless of per-tenant role (full license record — billing, `notes`, `settings`, `join_code` — visible to a same-tenant driver via direct SDK call, or to anyone another tenant's admin adds to their roster). The latter shares A33's root cause but restricting it risks breaking the invite-acceptance and degraded-mode tenant-discovery flows (`TenantContext.jsx` fallback), which legitimately need to read a not-yet-bound member's prospective tenant. Flagged for owner review before any read-side change — not modified in this pass.

---

### v1.26.0 Audit (2026-07-06)

Security, code quality, tenant isolation, permissions, and release-readiness audit covering all modules added since v1.25.0: Expense, AppSession, VehicleDocument, AI intake, active sessions, dashboard improvements, import extensions, and business settings.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A24 | `Expense` entity RLS: tenant-scoped, owner/admin only, write-gated. Route `/expenses` guarded by `RequireAccess page="expenses"`. | — | **CONFIRMED CLEAN** |
| A25 | `AppSession` entity RLS: self-scoped (created_by_id). No cross-tenant exposure — entity has no `tenant_id`. Service-role admin access is the Mission Control bridge only. | — | **CONFIRMED CLEAN** |
| A26 | `VehicleDocument` entity RLS: tenant-scoped, owner/admin/dispatcher write, mechanic read. Already in matrix v1.24.0. | — | **CONFIRMED CLEAN** |
| A27 | AI intake (`aiIntake.js`): sanitizes user input (strips HTML, controls unicode) before sending to LLM. No backend server function added; uses existing Base44 SDK `InvokeLLM`. | — | **CONFIRMED CLEAN** |
| A28 | `audit:tenant-scope` script added to CI (v1.26.0): statically detects unscoped read/update/delete branches in entity schemas. Cross-tenant SupportTicket leak (admin branch without tenant scope) fixed and prevented from regressing. | — | **FIXED and GUARDED** |
| A29 | `validate:rls` passes for all 24 entities. `audit:tenant-scope` passes for all multi-tenant entities. | — | **CONFIRMED CLEAN** |
| A30 | No hardcoded secrets, API keys, tokens, or credentials in source code. | — | **CONFIRMED CLEAN** |
| A31 | Permissions matrix: added `/expenses` to page access table, `Expense` and `AppSession` to RLS summary. No other gaps found vs v1.24.0 for new modules. | — | **UPDATED** |
| A32 | All 424 unit tests pass. Lint (direct), typecheck, build, validate:rls, audit:tenant-scope — all clean at HEAD. | — | **CONFIRMED PASSING** |

---

### v1.24.0 Audit (2026-06-29)

Security, code quality, tenant isolation, permissions, and dependency audit at v1.24.0. Removed unused `react-quill` dependency (quill XSS). No code-level permission or tenant isolation findings. All 21 entities RLS-verified clean.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A15 | Unused `react-quill` dependency declared in `package.json` but never imported in source — carries quill XSS (GHSA-4943-9vgg-gr5r) | MEDIUM | **FIXED — dependency removed** |
| A16 | 16 indirect dependency vulnerabilities in dev tools and transitive packages | LOW | **FIXED by `npm audit fix` — reduced from 23 to 5 remaining; all remaining are dev-only** |
| A17 | 5 remaining vulnerabilities in vite/vitest/esbuild (dev-only — no production exposure) | LOW | **Accepted — require breaking dep upgrades; no production risk** |
| A18 | No hardcoded secrets, API keys, tokens, or credentials found in source | — | **CONFIRMED CLEAN** |
| A19 | All 21 entity RLS rules verified — `data.tenant_id == {{user.data.tenant_id}}`; no bare field access | — | **CONFIRMED CLEAN** |
| A20 | Tenant isolation: generateAlerts, calculateCostPerKm, resolveTenant, manageMember all tenant-scoped | — | **CONFIRMED CLEAN** |
| A21 | Route protection: all routes covered by `RequireAccess` or `RequireAppOwner` | — | **CONFIRMED CLEAN** |
| A22 | Permissions matrix reviewed — no new modules or permissions gaps found vs v1.23.0 | — | **CONFIRMED CURRENT** |
| A23 | CI: lint, typecheck, tests (367/367), build, validate:rls — all pass on HEAD | — | **CONFIRMED PASSING** |

---

### v1.23.0 Audit (2026-06-22)

Security, code quality, tenant isolation, permissions, and release-readiness audit performed across all modules, entities, and server functions at app version 1.23.0. No code security vulnerabilities found. Documentation gaps resolved in this update.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A1 | Permissions matrix out of date (v1.0.2) — missing pages (Catalogs, Links, Help, GitHub, Supabase, Licenses, Tickets, Test Data, driver pages), missing entities (SupportTicket, Catalog, UsefulLink, DriverPrivateNote), outdated G2 note (page protection now enforced by RequireAccess), missing actions (support ticket, manage member, catalogs) | LOW | **FIXED — matrix updated to v1.23.0 in this audit** |
| A2 | G2 note in permissions matrix stated page protection is "client-side only" — incorrect since v1.18.0 | LOW | **FIXED — G2 crossed out and updated** |
| A3 | No hardcoded secrets, API keys, tokens, or credentials found in source | — | **CONFIRMED CLEAN** |
| A4 | Tenant isolation: all entity RLS rules filter by `data.tenant_id == user.data.tenant_id`; server functions filter by `tenantId` derived from authenticated user | — | **CONFIRMED CLEAN** |
| A5 | resolveTenant fallback: does not fall to `all[0]` for non-admin/owner users — uses Driver profile lookup or member matching | — | **CONFIRMED CLEAN** |
| A6 | generateAlerts: tenant-scoped via `tenantId` from authenticated user; role-gated (admin/owner only) | — | **CONFIRMED CLEAN** |
| A7 | calculateCostPerKm: tenant-scoped; role-gated (owner/admin/dispatcher); dispatcher access is intentional business rule | — | **CONFIRMED CLEAN** |
| A8 | manageMember: validates same-tenant before acting; protects tenant owner email and APP_OWNER_EMAIL | — | **CONFIRMED CLEAN** |
| A9 | Admin users list filtered by `data.tenant_id` — correct tenant isolation | — | **CONFIRMED CLEAN** |
| A10 | PermissionsPanel save: persists to `TenantLicense.permissions_config`; error state via `setSaveError`; success confirmation via `setSaved` | — | **CONFIRMED WORKING** |
| A11 | supabaseData / githubRepos / licensesAdmin / ticketsAdmin: all gated on `APP_OWNER_EMAIL` env var | — | **CONFIRMED CLEAN** |
| A12 | joinTenant: new members get `driver` role (minimum privilege) | — | **CONFIRMED CLEAN** |
| A13 | User entity: `tenant_id`, `role`, `suspended`, `write_access`, `driver_profile_id` all write:false (server-authoritative) | — | **CONFIRMED CLEAN** |
| A14 | CI: lint, typecheck, tests (367/367), build — all pass on current HEAD | — | **CONFIRMED PASSING** |

---

## Fixes Applied in v1.0.2

| # | Fix | File | Severity |
|---|-----|------|----------|
| F4 | `Messages.jsx` `Channel.list()` replaced with `Channel.filter({ tenant_id: tenantId })` — adds explicit defense-in-depth tenant filter for channel list | `src/pages/Messages.jsx` | LOW |
| F5 | `Messages.jsx` `Message.create()` missing `tenant_id` — added explicit tenant_id to both text and voice message creation for defense-in-depth | `src/pages/Messages.jsx` | LOW |
| F6 | `Financial.jsx`, `Drivers.jsx`, `Vehicles.jsx` `useEffect` missing `tenantId` dependency — data now reloads when tenant context changes | `src/pages/Financial.jsx`, `Drivers.jsx`, `Vehicles.jsx` | LOW |

## Fixes Applied in v1.0.1

| # | Fix | File | Severity |
|---|-----|------|----------|
| F1 | Dashboard `Message.filter` missing `tenant_id` — added explicit tenant filter for defense-in-depth | `src/pages/Dashboard.jsx` | MEDIUM |
| F2 | `Admin.jsx` `User.list()` replaced with `User.filter({ 'data.tenant_id': tenantId })` — scopes users list to current tenant for all roles including owner | `src/pages/Admin.jsx` | LOW |
| F3 | SDK version drift — updated all 5 Deno edge functions from `@base44/sdk@0.8.25` to `@0.8.31` | `base44/functions/*/entry.ts` | MEDIUM |

---

## Files Implementing Permissions

| File | Purpose |
|------|---------|
| `src/lib/permissions.js` | `ROLES`, `PAGE_PERMISSIONS`, `can()`, `isAdminOrOwner()`, `isOwner()`, `isDriver()` |
| `src/components/RequireAccess.jsx` | Route-level guard: applies `can(role, page)` at render time (v1.18.0+) |
| `src/components/RequireAppOwner.jsx` | Route-level guard for app-owner-only pages (Licenses, GitHub, Supabase, Tickets, TestData) |
| `src/components/Layout.jsx` | Sidebar nav filtered by `can(user.role, page)` |
| `src/components/admin/PermissionsPanel.jsx` | Granular per-module permissions UI + save to `TenantLicense.permissions_config` |
| `src/lib/modulePerms.js` | `DEFAULT_PERMISSIONS`, `NEW_PERMISSION_DEFAULT` — defaults for PermissionsPanel |
| `src/pages/Admin.jsx` | Admin page access guard (`isAdminOrOwner`) + member management |
| `src/pages/Billing.jsx` | Billing page access guard (`isAdminOrOwner`) |
| `src/lib/TenantContext.jsx` | Tenant resolution; revalidates every 15 min + on tab focus |
| `base44/entities/*.jsonc` | Entity-level RLS rules — all 21 entities have tenant_id-scoped RLS |
| `base44/entities/User.jsonc` | RLS: tenant-scoped read, role-gated update, server-authoritative fields (write:false) |
| `base44/functions/resolveTenant/entry.ts` | Source of truth for tenant binding, write_access, driver_profile_id |
| `base44/functions/generateAlerts/entry.ts` | Role guard: admin/owner only; tenant-scoped |
| `base44/functions/calculateCostPerKm/entry.ts` | Role guard: owner/admin/dispatcher; tenant-scoped |
| `base44/functions/fleetUnitMetrics/entry.ts` | Role guard: owner/admin only; tenant-scoped; powers `/reports` (utilidad, ranking, matriz día×unidad, pronóstico) |
| `base44/functions/manageMember/entry.ts` | Suspend/reactivate/remove — same-tenant validation; protects owner emails |
| `base44/functions/licensesAdmin/entry.ts` | Cross-tenant license management — gated on `APP_OWNER_EMAIL` |
| `base44/functions/submitTicket/entry.ts` | Support ticket creation — any authenticated tenant user |
| `base44/functions/ticketsAdmin/entry.ts` | Ticket management — gated on `APP_OWNER_EMAIL` |
| `base44/functions/supabaseData/entry.ts` | Supabase data access — gated on `APP_OWNER_EMAIL` |
| `base44/functions/githubRepos/entry.ts` | GitHub access — gated on `APP_OWNER_EMAIL` |
| `base44/functions/createTenant/entry.ts` | Tenant creation with cryptographic join code; prevents duplicates |
| `base44/functions/joinTenant/entry.ts` | Join by code — minimum privilege (driver role); blocked for cancelled/suspended tenants |
| `base44/functions/createTestData/entry.ts` | Seeds demo/test data — gated on `APP_OWNER_EMAIL` |
| `base44/functions/acaciaControl/entry.ts` | ACACIA Mission Control admin bridge — HMAC-signature-gated, no app user/tenant session; entity allowlist limits blast radius to `TenantLicense`/`SupportTicket`/`AppSession` |
| `base44/entities/AcaciaReplayKey.jsonc` | Anti-replay nonce store for `acaciaControl` — service-role-only RLS on all operations |
