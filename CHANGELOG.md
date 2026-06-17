# Changelog

All notable changes to Rumbo are documented here.

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
