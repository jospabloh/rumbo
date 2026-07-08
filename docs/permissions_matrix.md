# Rumbo — Granular Roles and Permissions Matrix

**Version 1.27.0 | Updated 2026-07-07**

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
| TenantLicense | owner only | creator / owner_email / member | creator / owner_email / member(owner,admin) | creator / owner_email |
| User | owner/admin (via server fn) | own record / same tenant_id (owner,admin) | own record / same-tenant owner,admin | same-tenant owner,admin |
| Vehicle | owner, admin, dispatcher | same tenant_id | owner, admin, dispatcher | owner, admin |
| Driver | owner, admin, dispatcher | same tenant_id | owner, admin, dispatcher | owner, admin |
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
| Expense | owner, admin (write-gated by `write_access`) | same tenant_id (owner, admin) | owner, admin (write-gated) | owner, admin (write-gated) |
| AppSession | any authenticated user (own row via `created_by_id`) | own row or service-role admin | own row or service-role admin | service-role admin only |
| DashboardUnitPref | own row (`created_by_id`, tenant-scoped) | own row only | own row only | own row only |
| UnitDayNote | owner, admin, dispatcher (write-gated) | same tenant_id (+ mechanic read) | owner, admin (write-gated) | owner, admin (write-gated) |

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
