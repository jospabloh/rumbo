# Changelog

All notable changes to Rumbo are documented here.

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
