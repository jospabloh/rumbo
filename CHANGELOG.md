# Changelog

All notable changes to Rumbo are documented here.

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
