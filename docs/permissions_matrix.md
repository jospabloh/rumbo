# Rumbo — Granular Roles and Permissions Matrix

**Version 1.0.2 | Updated 2026-06-15**

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

| Page | owner | admin | dispatcher | mechanic | driver | Enforcement |
|------|-------|-------|-----------|---------|--------|-------------|
| Dashboard (`/`) | ✅ | ✅ | ✅ | ❌ | ❌ | `permissions.js` `can()` → sidebar + route render |
| Drivers (`/drivers`) | ✅ | ✅ | ✅ | ❌ | ❌ | `permissions.js` |
| Vehicles (`/vehicles`) | ✅ | ✅ | ✅ | ✅ | ❌ | `permissions.js` |
| Rentas (`/rentas`) | ✅ | ✅ | ✅ | ❌ | ❌ | `permissions.js` + `RentCharge` RLS |
| Maintenance (`/maintenance`) | ✅ | ✅ | ❌ | ✅ | ❌ | `permissions.js` |
| Financial (`/financial`) | ✅ | ✅ | ❌ | ❌ | ❌ | `permissions.js` |
| Alerts (`/alerts`) | ✅ | ✅ | ✅ | ❌ | ❌ | `permissions.js` |
| Location (`/location`) | ✅ | ✅ | ✅ | ❌ | ❌ | `permissions.js` |
| Messages (`/messages`) | ✅ | ✅ | ✅ | ❌ | ❌ | `permissions.js` |
| Import (`/import`) | ✅ | ✅ | ❌ | ❌ | ❌ | `permissions.js` |
| Billing (`/billing`) | ✅ | ✅ | ❌ | ❌ | ❌ | `permissions.js` |
| Admin (`/admin`) | ✅ | ✅ | ❌ | ❌ | ❌ | `permissions.js` |
| Driver Home (`/driver/home`) | — | — | — | — | ✅ | Role-based nav |
| Driver Trips (`/driver/trips`) | — | — | — | — | ✅ | Role-based nav |
| Driver Profile (`/driver/profile`) | — | — | — | — | ✅ | Role-based nav |

**Note:** Page protection is client-side only (sidebar nav + component-level role check). Direct URL navigation is not blocked at router level. See `src/lib/permissions.js` and `src/components/Layout.jsx`.

---

## Granular Module Permissions (PermissionsPanel — Admin-Configurable)

The following matrix shows **default values** for configurable roles. Admin explicitly grants/revokes these per tenant.

### Default: Dispatcher

| Module | View | Create | Edit | Delete | Pause | Enforced in Backend |
|--------|------|--------|------|--------|-------|---------------------|
| Vehicles | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Drivers | ✅ | ✅ | ✅ | ❌ | ✅ | Entity RLS |
| Trips | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Maintenance | ✅ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Parts/Inventory | ❌ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Fuel | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Fines | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Insurance | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Alerts | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Messages | ✅ | ✅ | ✅ | ❌ | ❌ | Entity RLS |
| Location | ✅ | ❌ | ❌ | ❌ | ❌ | Entity RLS |
| Financial | ❌ | ❌ | ❌ | ❌ | ❌ | Page-level guard |
| Reports/Import | ❌ | ❌ | ❌ | ❌ | ❌ | Page-level guard |

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
| Delete tenant | admin, owner | `Admin.jsx` DangerZone | Requires typing "ELIMINAR" |
| Delegate tenant ownership | admin, owner | `Admin.jsx` DangerZone | Updates `owner_email` |
| Generate alerts | admin, owner | `generateAlerts` server function | 403 for other roles |
| Calculate cost-per-km | admin, owner, dispatcher | `calculateCostPerKm` server function | 403 for driver/mechanic |
| View all tenants (SuperAdmin) | owner only | `Admin.jsx` `isOwner()` check | SuperAdminPanel visible only to owner |
| Edit TenantLicense plan/status | owner only | `SuperAdminPanel.jsx` | Only visible to owner |
| View Billing page | admin, owner | `Billing.jsx` `isAdminOrOwner()` check | Access denied shown for others |
| View Admin page | admin, owner | `Admin.jsx` `isAdminOrOwner()` check | Access denied shown for others |

---

## Backend / Entity RLS Summary

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| TenantLicense | owner only | creator / owner_email / member | creator / owner_email / member(owner,admin) | creator / owner_email |
| User | — | own record / same tenant_id | own record / same-tenant owner,admin | — |
| Vehicle | owner, admin, dispatcher | same tenant_id | owner, admin, dispatcher | owner, admin |
| Driver | owner, admin, dispatcher | same tenant_id | owner, admin, dispatcher | owner, admin |
| Trip | (per RLS) | same tenant_id | (per RLS) | owner, admin |
| RentCharge | owner, admin, dispatcher | same tenant_id + role or own driver_id | owner, admin, dispatcher | owner, admin |
| Alert | owner, admin, dispatcher | same tenant_id + role or own driver_id | owner, admin, dispatcher | owner, admin |
| Message | sender (tenant-scoped) | same tenant_id + role or own sender_id | creator / owner, admin, dispatcher | owner, admin |
| Channel | owner, admin, dispatcher | same tenant_id + role, broadcast, or own driver_id | owner, admin, dispatcher | owner, admin |
| FuelLog | (per entity RLS) | same tenant_id | (per RLS) | owner, admin |
| Fine | (per entity RLS) | same tenant_id | (per RLS) | owner, admin |
| InsuranceClaim | (per entity RLS) | same tenant_id | (per RLS) | owner, admin |
| Maintenance | owner, admin, mechanic | same tenant_id | owner, admin, mechanic | owner, admin |
| Part | owner, admin, mechanic | same tenant_id | owner, admin, mechanic | owner, admin |
| DriverDocument | owner, admin, dispatcher | same tenant_id + role or own driver_id | owner, admin, dispatcher | owner, admin |
| VehicleDocument | owner, admin, dispatcher | same tenant_id | owner, admin, dispatcher | owner, admin |
| LocationRequest | owner, admin, dispatcher | same tenant_id + role/driver/requester | owner, admin, dispatcher, own driver | owner, admin |

---

## Known Gaps and Accepted Risks

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| G1 | Granular PermissionsPanel permissions are saved to backend (v1.0.0) but not yet enforced at the API/entity level — only used in admin UI display | MEDIUM | **Documented — enforcement is a future priority** |
| G2 | Page protection is client-side only (no server-side route guard) — a user with the URL could navigate directly | LOW | **Accepted — Base44 entity RLS provides data-level protection** |
| G3 | `TenantLicense` read RLS allowed any `admin` to read all TenantLicenses — cross-tenant license/PII exposure | ~~LOW~~ | **FIXED v1.4.0 — read scoped to creator / owner_email / members.email; invites now populate members[]** |
| G4 | New users invited but not yet logged in lack `tenant_id` in their profile — they may not appear in tenant user lists immediately | LOW | **Accepted — resolves automatically on first login** |

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
| `src/components/Layout.jsx` | Sidebar nav filtered by `can(user.role, page)` |
| `src/components/admin/PermissionsPanel.jsx` | Granular per-module permissions UI + save to `TenantLicense.permissions_config` |
| `src/pages/Admin.jsx` | Admin page access guard (`isAdminOrOwner`) |
| `src/pages/Billing.jsx` | Billing page access guard (`isAdminOrOwner`) |
| `base44/entities/*.jsonc` | Entity-level RLS rules (all entities except User historically) |
| `base44/entities/User.jsonc` | RLS added in v1.0.0: tenant-scoped read, role-gated update |
| `base44/functions/generateAlerts/entry.ts` | Role guard: admin/owner only |
| `base44/functions/calculateCostPerKm/entry.ts` | Role guard: owner/admin/dispatcher (added v1.0.0) |
