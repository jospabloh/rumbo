# Rumbo — Granular Roles and Permissions Matrix

**Version 1.30.3 | Updated 2026-08-11**

---

## Roles

| Role | Description | Tenant-Scoped |
|------|-------------|---------------|
| `owner` | Platform owner; full access + license management | Yes (own tenant only) |
| `admin` | Tenant administrator; full operational access | Yes |
| `dispatcher` | Fleet operator; configurable access | Yes |
| `mechanic` | Workshop technician; configurable access | Yes |
| `driver` | Driver; limited personal data access | Yes |
| `investor` | Socio/inversionista; read-only, scoped to a subset of units via `owner_group_id` (see below) | Yes |

---

## Page / Route Access

All pages except the driver portal and help are protected by `RequireAccess` (which applies `can(role, page)` at the route level) or `RequireAppOwner` for platform-owner-only pages. Sidebar nav is additionally filtered by `can()`. As of v1.18.0, direct URL navigation to a restricted page shows an "Acceso restringido" screen — it is no longer silently accessible by URL.

| Page | owner | admin | dispatcher | mechanic | driver | investor | Enforcement |
|------|-------|-------|-----------|---------|--------|----------|-------------|
| Dashboard (`/`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="dashboard"` + `permissions.js` `can()` |
| Drivers (`/drivers`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="drivers"` |
| Vehicles (`/vehicles`) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | `RequireAccess page="vehicles"` |
| Rentas (`/rentas`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="rentas"` + `RentCharge` RLS |
| Maintenance (`/maintenance`) | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | `RequireAccess page="maintenance"` |
| Parts/Inventory (embedded in `/maintenance`) | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | Same as maintenance |
| Financial (`/financial`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `RequireAccess page="financial"` |
| Reportes (`/reports`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `RequireAccess page="reports"` + `fleetUnitMetrics` server function (owner/admin only) |
| Expenses (`/expenses`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `RequireAccess page="expenses"` + `Expense.jsonc` RLS |
| Alerts (`/alerts`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="alerts"` |
| Location (`/location`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="location"` |
| Messages (`/messages`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | `RequireAccess page="messages"` |
| Import (`/import`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `RequireAccess page="import"` |
| Billing (`/billing`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `RequireAccess page="billing"` |
| Admin (`/admin`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `RequireAccess page="admin"` |
| Catalogs (`/catalogs`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `RequireAccess page="catalogs"` |
| Links/Útiles (`/links`) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | `RequireAccess page="links"` |
| Help/Centro de ayuda (`/help`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `RequireAccess page="help"` (all authenticated roles) |
| Driver Home (`/driver/home`) | — | — | — | — | ✅ | — | `RequireAccess roles={['driver']}` |
| Driver Trips (`/driver/trips`) | — | — | — | — | ✅ | — | `RequireAccess roles={['driver']}` |
| Driver Profile (`/driver/profile`) | — | — | — | — | ✅ | — | `RequireAccess roles={['driver']}` |
| Driver Messages (`/driver/messages`) | — | — | — | — | ✅ | — | `RequireAccess roles={['driver']}` |
| Investor Home (`/investor/home`) | — | — | — | — | — | ✅ | `RequireAccess roles={['investor']}`; read-only, scoped by `owner_group_id` (Vehicle/Maintenance/RentCharge RLS) |
| GitHub (`/github`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` (gated on `APP_OWNER_EMAIL`) |
| Supabase (`/supabase`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` |
| Licenses (`/licenses`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` |
| Support Tickets (`/tickets`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` |
| Test Data (`/test-data`) | ✅ (app owner) | ❌ | ❌ | ❌ | ❌ | ❌ | `RequireAppOwner` |

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
| Join tenant by code | any authenticated user (enters as `driver`, minimum privilege) | `joinTenant` server function | Rate-limited v1.30.3: 10 attempts / 15 min / user (`JoinAttempt` ledger), defense-in-depth on top of the 32⁶ ≈ 1.07B code space |
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
| TenantLicense | owner, admin⁴ | creator / owner_email / member | owner_email, or (own bound tenant + member + owner/admin)¹ | creator / owner_email |
| User | owner/admin (via server fn) | own record / same tenant_id (owner,admin) | own record / same-tenant owner,admin; `role` and `owner_group_id` are field-level owner/admin-only³ | same-tenant owner,admin |
| Vehicle | owner, admin, dispatcher | same tenant_id + role, own assigned driver, or (investor + matching `owner_group_id`)³ | owner, admin, dispatcher | owner, admin |
| Driver | owner, admin, dispatcher | same tenant_id | owner, admin, dispatcher (entity-level); self (`profile_id`) limited to `phone` only, field-level² | owner, admin |
| Trip | (per RLS) | same tenant_id | (per RLS) | owner, admin |
| RentCharge | owner, admin, dispatcher | same tenant_id + role, own driver_id, or (investor + matching `owner_group_id`)³ | owner, admin, dispatcher | owner, admin |
| Alert | owner, admin, dispatcher | same tenant_id + role or own driver_id | owner, admin, dispatcher | owner, admin |
| Message | sender (tenant-scoped) | same tenant_id + (role / own sender_id / broadcast channel / own driver channel) | creator / owner, admin, dispatcher | owner, admin |
| Channel | owner, admin, dispatcher | same tenant_id + role, broadcast, or own driver_id | owner, admin, dispatcher | owner, admin |
| FuelLog | (per entity RLS) | same tenant_id | (per RLS) | owner, admin |
| Fine | (per entity RLS) | same tenant_id | (per RLS) | owner, admin |
| InsuranceClaim | (per entity RLS) | same tenant_id | (per RLS) | owner, admin |
| Maintenance | owner, admin, mechanic | same tenant_id + role, or (investor + matching `owner_group_id`)³ | owner, admin, mechanic | owner, admin |
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
³ **Added v1.30.0 — investor unit scoping.** `owner_group_id` is a free-text tag set by owner/admin: on a `User` (role `investor`) it names which "sociedad" that user belongs to; on a `Vehicle` it names which sociedad owns that unit. `Maintenance`/`RentCharge` denormalize the same tag from their `Vehicle` at write time (same pattern as `driver_id`), since Base44 RLS templates can't join across entities. Every investor read branch requires **both** `user_condition.role == "investor"` **and** `data.owner_group_id != null` on the record before comparing it to `{{user.data.owner_group_id}}` — this closes the "both sides blank" failure mode the JSON-schema-RLS class of bugs is prone to (an unassigned investor or an untagged unit must never match each other). See "Investor Unit Scoping" below.
⁴ `admin` create access is a direct-SDK-call defense-in-depth branch — the real creation path is server-side via `createTenant` (service role, cryptographic join code, duplicate prevention). `tenant_id` doesn't apply to `TenantLicense` (the record *is* the tenant), so this isn't a cross-tenant create — see `audit-tenant-scope.mjs`'s create-exemption rule for identity-creation entities.
⁵ **Fixed v1.30.3 (A56) — was a cross-tenant exposure.** RLS previously read `user_condition:{role:"admin"}` for the service-role branch — an ordinary role any tenant's admin holds, not a service-role sentinel. Since `AppSession` has no `tenant_id` field, that granted every tenant's admin full access to every *other* tenant's session rows. Now `user_condition:{role:"__service_role_only__"}` (same sentinel as `AcaciaReplayKey`), matching what was actually intended: the `acaciaControl` bridge reads/writes via `base44.asServiceRole`, which bypasses RLS entirely, so it never needed — and never used — the old `admin` branch.
| Expense | owner, admin (write-gated by `write_access`) | same tenant_id (owner, admin) | owner, admin (write-gated) | owner, admin (write-gated) |
| AppSession | own row (via `created_by_id`) or service-role⁵ | own row or service-role⁵ | own row or service-role⁵ | service-role only |
| DashboardUnitPref | own row (`created_by_id`, tenant-scoped) | own row only | own row only | own row only |
| UnitDayNote | owner, admin, dispatcher (write-gated) | same tenant_id (+ mechanic read) | owner, admin (write-gated) | owner, admin (write-gated) |
| AcaciaReplayKey | service role only | service role only | service role only | service role only | Anti-replay nonce store for `acaciaControl`; no tenant_id (not tenant data), no app user (owner/admin/etc.) can read/write it — see below |
| JoinAttempt | service role only | service role only | service role only | service role only | Rate-limit ledger for `joinTenant` — added v1.30.3 (A56), same service-role-only pattern as `AcaciaReplayKey` |

---

## Investor Unit Scoping (v1.30.0)

Some tenants split ownership of their fleet across informal partnerships ("sociedades") —
e.g. 8 of 11 units belong to the tenant owner and 3 belong to a different investor. The
`investor` role gives that person read-only access to **only** their subset of units:
unit status (`Vehicle`), maintenance history (`Maintenance`), and rent-payment status
(`RentCharge`) — nothing else in the tenant (no drivers, messages, financials, other units).

**Why a tag instead of a list/join:** Base44's JSON-schema RLS supports field-to-field
equality/`$in`/`$nin`/`$ne` against **literal** values or a single `{{user.data.*}}`
template, but not "entity field is a member of a dynamic array on the user record" or
cross-entity joins (confirmed against the platform's own RLS reference examples — see
`base44-cli/references/rls-examples.md` in the `claude-skills` toolbox repo). So instead of
a many-to-many list, ownership is modeled the same way `Driver`↔`Vehicle` already is
(`assigned_driver_id` / `driver_profile_id`): a scalar tag, `owner_group_id`, set on both
sides by owner/admin.

- **Setup (owner/admin only):** in Admin, set a member's role to `investor` and give them
  an `owner_group_id` (free text, e.g. `"suegra"`). In Vehicles, set the same
  `owner_group_id` on every unit that sociedad owns. A tenant can have any number of
  distinct groups (one per sociedad); a unit belongs to at most one group.
- **Enforcement:** `Vehicle`/`Maintenance`/`RentCharge` read RLS each add one `$and` branch:
  `role == "investor"` AND `owner_group_id != null` (on the record) AND
  `owner_group_id == {{user.data.owner_group_id}}`. The `!= null` guard is required —
  without it, an investor who hasn't been assigned a group yet and a unit that hasn't
  been tagged yet would both resolve to "empty" and match each other, exactly the class of
  silent RLS bug this codebase's `validate:rls`/`audit:tenant-scope` scripts exist to catch.
- **Denormalization:** `Maintenance.owner_group_id` and `RentCharge.owner_group_id` are
  copied from their `Vehicle` at create/update time (`Rentas.jsx`, `MaintenancePage.jsx`,
  `ManualChargeModal.jsx`) rather than looked up live, since RLS can't join. The Reports-page
  quick-add shortcut (`RegistrarMenu`/`QuickIncomeModal`, fed by the `fleetUnitMetrics`
  aggregate rather than raw `Vehicle` rows) does **not** yet propagate the tag — a
  known, accepted gap: records created there simply won't appear in the investor's view
  until backfilled or re-saved from the main Rentas/Maintenance pages, which is a
  fail-closed (under-share, never over-share) omission.
- **Write access:** `investor` has no write access to any of these entities — the role is
  intentionally read-only, matching the ask (view unit status, maintenance, and rent/driver
  payment status; not edit anything).
- **UI:** `/investor/home` (`RequireAccess roles={['investor']}`) is the only route the role
  can reach besides `/help`; `RequireAccess` redirects an investor who lands on any staff
  route back to `/investor/home`, mirroring the existing driver redirect.

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
| G6 | `Catalog`/`UsefulLink` `read` RLS has an `{"data.active":true}` branch with no role gate — any tenant role (including driver/investor, both UI-blocked from `/links`) can read active catalog/link rows via a direct SDK call | LOW | **Accepted — low-sensitivity data (link labels/URLs, catalog item names), not PII. Flagged v1.30.3 (A57), not changed this pass: tightening the read rule risks breaking a legitimate not-yet-audited caller (e.g. a driver-facing screen reading links directly rather than through `/links`) without a way to verify that live in this environment. Needs a source read of every `Catalog`/`UsefulLink` consumer before restricting.** |

---

## Audit History

### v1.30.3 Audit (2026-08-11)

Full automated security/tenant-isolation/permissions/code-quality/release-readiness
audit (`audit/rumbo-full-review`). Three independent research passes (auth/session/
injection/PII/rate-limiting; code quality/architecture; an independent backend
cross-check of this matrix against the actual `base44/entities/*.jsonc` RLS, not
trusting the matrix's own prose) plus manual verification before every fix below.
No open, draft, or disconnected pull requests existed at audit start.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A56 | `AppSession.jsonc` cross-tenant exposure: RLS used `user_condition:{role:"admin"}` — an ordinary role any tenant's admin holds — where a service-role sentinel (as `AcaciaReplayKey.jsonc` already correctly used) was clearly intended per the file's own comment ("service role (role:admin)"). `AppSession` has no `tenant_id` field, so this granted every tenant's admin full read/update/delete over every OTHER tenant's session rows (email, device, timestamps, force-revoke) via a direct SDK call. Confirmed the `acaciaControl` bridge never relied on this branch (reads/writes via `base44.asServiceRole`, which bypasses RLS entirely) and no in-app UI reads other users' sessions (only `SessionHeartbeat.jsx`, self-scoped) — so this was purely unintended, no legitimate caller depended on it. | CRITICAL | **FIXED — all 4 ops now `user_condition:{role:"__service_role_only__"}`; `validate:rls`/`audit:tenant-scope`/tests/build all pass** |
| A57 | `DriverPrivateNote.jsonc` granted `dispatcher` create/read/update access to an entity both this matrix and the UI itself (`DriverDetail.jsx`: "Notas privadas (solo admin)") have always documented/labeled owner/admin only. The frontend's own gate (`isAdmin = role !== 'driver'`) was equally over-broad — it includes dispatcher. Also flagged this pass: `Catalog`/`UsefulLink` `read` RLS has an ungated `active:true` branch (see Known Gaps G6, not fixed — low sensitivity, needs a consumer-read pass first); `TenantLicense.create` RLS actually allows `admin` (not "owner only" as this matrix previously stated) — doc-only correction, real creation path is server-side via `createTenant` regardless. | HIGH | **FIXED (DriverPrivateNote) — dispatcher removed from all 3 RLS branches; `DriverDetail.jsx` gate replaced with a dedicated `canManagePrivateNotes` check. Doc corrections applied for the other two.** |
| A58 | Systemic: of 23 entities with a `tenant_id` field, only `User.tenant_id` had field-level `rls.write:false`. Entity-level update RLS only checks the record's *existing* `tenant_id`, not what a patch payload might try to change it to — the same bug class as A33 (fixed only for `TenantLicense.id`), unaddressed everywhere else. Unconfirmed whether Base44 re-validates RLS against the post-patch document (which would neutralize this) — treated as an open question per this audit's "unconfirmed isolation is Critical" standard, not a confirmed exploit. Grepped every `.update()` call in `src/` and `base44/functions/`: none ever sends `tenant_id` in an update payload, so closing it has zero behavior impact on any real code path. | CRITICAL (unconfirmed → closed) | **FIXED — added `rls.write:false` on `tenant_id` to all 21 remaining entities that have the field, mirroring the pattern already proven safe on `User.tenant_id`** |
| A59 | `joinTenant` had no attempt counter on its join-code lookup — a tenant-boundary-crossing surface reachable by any authenticated user. The 32⁶ ≈ 1.07B code space makes blind brute force impractical on its own; this is defense-in-depth in case that assumption is ever violated (weaker codes later, or an attacker controlling many accounts). | MEDIUM | **FIXED — new `JoinAttempt` entity (service-role-only RLS, mirrors `AcaciaReplayKey`'s persistent-store pattern): 10 attempts / 15 min / user, stale rows pruned** |
| A60 | `githubRepos/entry.ts` built GitHub API URLs by string-concatenating `owner`/`repo`/`path`/`branch` with no encoding. Owner-only endpoint (bounded impact — worst case is the owner's own request shaping extra query params against their own GitHub token) but still a real gap. | LOW | **FIXED — `ghSeg()`/`ghPath()` encoding helpers added, applied to all 8 call sites** |
| A61 | `DriverForm.jsx`'s driver-document uploads (license, INE, address-proof — real PII documents) had zero client-side validation of any kind ("se suben tal cual para preservar PDFs" — by design, to not run PDFs through the image compressor) and the photo-upload handler had no error handling. The real enforcement is Base44's opaque `UploadFile` platform integration, which this repo can't verify. | MEDIUM | **FIXED for this path — shared `validateUploadFile()` (extension allowlist + size cap, `src/lib/uploadValidation.js`, 9 unit tests) wired into both handlers; try/catch added to the photo handler. Scoped to the most sensitive path this pass — vehicle documents, tenant logos, and note attachments should get the same treatment as a fast-follow.** |
| A62 | Code quality: `GitHubPage.jsx` and `SupabasePage.jsx` (external-integration pages, most likely to actually fail) had no `.catch` anywhere — a rejected call left the page silently empty or `loadingRows` stuck `true` forever. `Layout.jsx` (core, always-loaded) imported `applyTenantColors` from `TenantOnboarding.jsx` (a one-time onboarding wizard page). `ContinueAs.jsx` was a fully-built, zero-import dead component duplicating `Login.jsx`. `npm audit`: react-router (moderate, open-redirect/SSR-hydration) and the vitest/vite/esbuild dev chain (moderate/high/critical) had been carried as accepted risk since A44/A45/A47/A48 pending major-version bumps. | — | **FIXED — error state + banner added to both pages; `applyTenantColors`/`hexToHsl` moved to `src/lib/palettes.js` (+13 tests, previously untestable); `ContinueAs.jsx` removed; `react-router-dom` 6.30.4→7.18.2 and `vitest` 2.1.9→4.1.10 upgraded (`npm audit`: 5 vulnerabilities → 0), no source changes required, full route-tree/test coverage re-verified green after both** |
| A63 | Re-confirmed clean: no hardcoded secrets/API keys/tokens; `resolveTenant`/`generateAlerts`/`calculateCostPerKm`/`manageMember`/admin-users-list/`PermissionsPanel` all sound and unchanged; `acaciaControl` HMAC verification, timing-safe compare, anti-replay store, entity allowlist all intact; all 7 `APP_OWNER_EMAIL`-gated functions match their documented gate; `supabaseData`'s PostgREST query building is regex-allowlisted and `encodeURIComponent`-escaped (exceeds, not just matches, the doc's claim); no `eval`/`new Function`/unescaped `innerHTML`; SDK version aligned (`@base44/sdk@0.8.41`) across frontend and all 14 backend functions. `validate:rls` (27 entities, was 26), `audit:tenant-scope`, lint, typecheck, all 463 unit tests (was 446; +17 new), and the production build all pass at HEAD. | — | **CONFIRMED CLEAN / CONFIRMED PASSING** |

**No open, draft, or disconnected pull requests found** at audit start. No unresolved GitHub issues.

---

### v1.30.2 Audit (2026-08-10)

Automated security, tenant-isolation, permissions, code quality, and release-readiness audit. Triggered by discovering `main`'s HEAD was an unreviewed, bot-authored commit pushed directly with no PR — no other commits or open/draft/disconnected PRs existed at audit start.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A53 | `TenantLicense.update` RLS regression (recurrence of A33, second recurrence overall): a `base44-builder[bot]` commit ("Apply RLS security recommendations", pushed directly to `main`, no PR/review) removed the `data.members.email` branch from the tenant-scoped `$and` — the exact same regression already fixed once this same day (via PR #88). The live Base44-deployed schema (verified via `list_entity_schemas`, not just the repo) had the same gap, confirming this was exploitable in production, not only a CI/repo issue. `audit:tenant-scope` failed on `main` HEAD as a direct, correct result. | CRITICAL | **FIXED — branch restored in the repo and redeployed live via the Base44 schema API; verified byte-for-byte via `list_entity_schemas`; `audit:tenant-scope` passes again** |
| A54 | Process root cause: `main` has no branch protection rule, which is how an automated bot commit (twice now) reached production without any PR or review. Not a code-level finding — no tool in this session's GitHub scope can configure branch protection. | — (process) | **Flagged for owner action — recommend requiring PR review on `main`, including for bot-authored commits** |
| A55 | Re-confirmed clean, no drift since v1.30.1: `resolveTenant` tenant-binding, `generateAlerts`/`calculateCostPerKm` tenant scoping and role gating, admin users list tenant filtering, `PermissionsPanel` save/reload, no hardcoded secrets/API keys/tokens, SDK alignment (`@base44/sdk@0.8.41` frontend + all 14 backend functions). Every other `base44/entities/*.jsonc` file was checked against the same bot commit's diff — only `TenantLicense.jsonc` was touched. Permissions matrix, user manual, and role/permission model are unaffected by this fix — no user-facing behavior changed. | — | **CONFIRMED CLEAN** |

**No open, draft, or disconnected pull requests found** at audit start. No unresolved GitHub issues.

---

### v1.30.1 Audit (2026-08-03)

Full automated security, tenant-isolation, permissions, code quality, and release-readiness audit covering all changes since v1.30.0 (a bot-authored `@base44/sdk` bump was the only commit — no application logic changed). No open, draft, or disconnected pull requests found; no stale branches carried unmerged work at audit start.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A50 | SDK version drift recurrence: frontend `@base44/sdk` moved to `^0.8.41` (bot-authored "Update base44 packages" commit) while all 14 backend Deno functions remained pinned to `@0.8.40`. Same root cause as A35/A41. | LOW/MEDIUM | **FIXED — all 14 functions re-pinned to `@0.8.41`** |
| A51 | `npm audit`: `brace-expansion` (high, ReDoS) had a non-breaking transitive dedupe fix available. | HIGH (dev-only) | **FIXED — `npm audit fix` applied (`brace-expansion` 1.1.16→1.1.18), no `package.json` range changes** |
| A52 | Re-confirmed clean: `resolveTenant` tenant-binding fallback (no `all[0]` risk); `generateAlerts`/`calculateCostPerKm` tenant scoping and role gating; admin users list tenant filtering; `PermissionsPanel` save persists + reloads tenant context; no hardcoded secrets/API keys/tokens. `react-router`/`react-router-dom` and the `vitest`/`vite`/`esbuild` dev chain re-confirmed as accepted risk (unchanged, no exploitable path / no production exposure). `validate:rls` (26 entities), `audit:tenant-scope` (zero findings), lint, typecheck, all 446 unit tests, and the production build all pass at HEAD. `USER_MANUAL.md` "Updated" date stamp was stale (2026-07-27) despite content already reflecting the v1.30.0 investor role — corrected. | — | **CONFIRMED CLEAN / CONFIRMED PASSING** |

**No open, draft, or disconnected pull requests found** at audit start. No unresolved GitHub issues. Stale merged-branch leftovers (`fix/driver-access`, `fix/rls-canonical`, `fix/tenantlicense-residual-access`, `fix/tenantlicense-rls`, `chore/typecheck-clean`, `prod-readiness`) predate this audit lineage, carry no open PRs, and their content is already merged into `main` under separate merge commits — no action required.

---

### v1.29.2 Audit (2026-07-28)

Full re-run of the security, tenant-isolation, permissions, code quality, and release-readiness audit. No application commits landed since the v1.29.1 merge (HEAD unchanged at `83b22667`) — this pass re-verifies the codebase from a clean baseline rather than reviewing a diff.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| A47 | `npm audit` at HEAD: 13 findings (5 moderate, 7 high, 1 critical), up from 10 at the last audit — same `vitest`/`vite`/`esbuild`/`eslint`/`eslint-plugin-react`/`brace-expansion`/`minimatch`/`@eslint/*` dev-tooling chain, now with newer/reclassified advisories (including one now rated critical, `vitest<=3.2.5`). Confirmed dev-only via `npm audit --omit=dev` (zero results beyond A44's `react-router`). Fixing requires breaking `vitest@4`/`eslint@10` upgrades — same accepted-risk lineage as A17/A45. | LOW/CRITICAL (dev-only) | **Accepted risk — reconfirmed no production exposure** |
| A48 | `react-router`/`react-router-dom` open-redirect + SSR-hydration advisories (same as A44) re-verified against current HEAD: no non-breaking patch exists (latest 6.x, `6.30.4`, is already installed and still in the vulnerable `6.0.0–7.17.0` range; the fix requires the v7 major). Re-grepped every `navigate(...)`/`<Link to={...}>`/`<Navigate to={...}>` call site — all targets are internal, static, or derived from role (`resolveHomeTarget`) or the app's own `localStorage`-persisted path, never from URL/query input. No SSR in this app. | MODERATE | **Accepted risk — reconfirmed no exploitable path, unchanged from A44** |
| A49 | Re-confirmed clean, no drift: `@base44/sdk` already aligned at `^0.8.40` across the frontend and all 14 backend Deno functions (no recurrence of A35/A41). `acaciaControl`/`AcaciaReplayKey` bridge re-read line-by-line — HMAC verification, timing-safe compare, persistent anti-replay store, 3-entity allowlist, email-relay recipient/size validation all intact and unchanged. No hardcoded secrets/API keys/tokens. `validate:rls` (26 entities), `audit:tenant-scope`, lint, typecheck, all 440 unit tests, and the production build all pass at HEAD. Applied `npm audit fix` (non-breaking transitive dedupe of `@eslint/*` sub-dependencies) — no vulnerability count change, no `package.json` range changes. | — | **CONFIRMED CLEAN / CONFIRMED PASSING** |

**No open, draft, or disconnected pull requests found** at audit start — the prior audit (PR #84) was cleanly merged, and no work-in-progress branches existed. No unresolved GitHub issues. CI green on `main` at HEAD.

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
| `src/lib/permissions.js` | `ROLES`, `PAGE_PERMISSIONS`, `can()`, `isAdminOrOwner()`, `isOwner()`, `isDriver()`, `isInvestor()` |
| `src/lib/nav.js` | `INVESTOR_NAV`, `resolveHomeTarget()` → `/investor/home` for the investor role |
| `src/pages/investor/InvestorHome.jsx` | Read-only investor panel: unit status, maintenance history, rent-payment status — scoped by `owner_group_id` |
| `src/components/RequireAccess.jsx` | Route-level guard: applies `can(role, page)` at render time (v1.18.0+); redirects driver/investor off staff routes to their own home |
| `src/components/RequireAppOwner.jsx` | Route-level guard for app-owner-only pages (Licenses, GitHub, Supabase, Tickets, TestData) |
| `src/components/Layout.jsx` | Sidebar nav filtered by `can(user.role, page)` |
| `src/components/admin/PermissionsPanel.jsx` | Granular per-module permissions UI + save to `TenantLicense.permissions_config` |
| `src/lib/modulePerms.js` | `DEFAULT_PERMISSIONS`, `NEW_PERMISSION_DEFAULT` — defaults for PermissionsPanel |
| `src/pages/Admin.jsx` | Admin page access guard (`isAdminOrOwner`) + member management |
| `src/pages/Billing.jsx` | Billing page access guard (`isAdminOrOwner`) |
| `src/lib/TenantContext.jsx` | Tenant resolution; revalidates every 15 min + on tab focus |
| `base44/entities/*.jsonc` | Entity-level RLS rules — 27 entities total; 23 have a `tenant_id` field, all field-level `write:false` since v1.30.3 (A58) so an update payload can't repoint an existing record at another tenant, even post-entity-gate; the other 4 (`TenantLicense`, `AppSession`, `AcaciaReplayKey`, `JoinAttempt`) are scoped by identity/service-role instead |
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
| `base44/functions/joinTenant/entry.ts` | Join by code — minimum privilege (driver role); blocked for cancelled/suspended tenants; rate-limited since v1.30.3 |
| `base44/entities/JoinAttempt.jsonc` | Rate-limit ledger for `joinTenant` — service-role-only RLS, same pattern as `AcaciaReplayKey` |
| `base44/functions/createTestData/entry.ts` | Seeds demo/test data — gated on `APP_OWNER_EMAIL` |
| `base44/functions/acaciaControl/entry.ts` | ACACIA Mission Control admin bridge — HMAC-signature-gated, no app user/tenant session; entity allowlist limits blast radius to `TenantLicense`/`SupportTicket`/`AppSession` |
| `base44/entities/AcaciaReplayKey.jsonc` | Anti-replay nonce store for `acaciaControl` — service-role-only RLS on all operations |
