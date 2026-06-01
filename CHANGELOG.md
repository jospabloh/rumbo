# Changelog

All notable changes to Rumbo are documented in this file.

## [1.0.0] — 2026-06-01

### Security Fixes
- **[HIGH]** `generateAlerts` function: fixed cross-tenant data leak where `DriverDocument.list()` and `VehicleDocument.list()` were called without a tenant scope, exposing documents from all tenants to service-role queries. Now filtered by driver/vehicle IDs belonging to the current tenant only.
- **[HIGH]** `calculateCostPerKm` function: added role authorization check. The endpoint now requires `owner`, `admin`, or `dispatcher` role. Previously any authenticated user (including drivers) could retrieve fleet financial analysis data.
- **[MEDIUM]** `PermissionsPanel`: permissions configuration is now persisted to `TenantLicense.permissions_config`. Prior to this fix the Permissions UI was purely cosmetic — settings were lost on every page refresh.

### New Features
- **Permissions system**: granular role-based permissions are now saved per-tenant in the license record. Admins have full access by default; all other roles (dispatcher, mechanic, driver) default to no access and must be explicitly granted permissions by an admin.
- **TenantLicense schema**: added `permissions_config` field to store serialized role-permission configuration.
- **Permissions page**: added `reports` as an explicit permission key in `PAGE_PERMISSIONS`, aligning sidebar visibility with module-level access control.

### Improvements
- Version tracking established at `1.0.0` (was `0.0.0`).
- Permissions panel now shows admin role as locked to full-access (read-only display) to prevent accidental restriction.
- Non-admin roles display toggles that start at false, requiring explicit admin grant.

---

## [0.x] — Prior to 2026-06-01 (Base44 builder commits)

### Features (delivered via Base44 builder — `base44-builder[bot]` commits)
- Multi-tenant SaaS architecture with `TenantLicense` as the root tenant container.
- Role-based access control: `owner`, `admin`, `dispatcher`, `mechanic`, `driver`.
- Row-Level Security (RLS) applied across all 17 entities to enforce tenant data isolation.
- Fleet management: vehicles, drivers, trips, maintenance scheduling, parts inventory.
- Financial module: fuel logs, traffic fines, insurance claims, cost-per-km analytics.
- Alert system: auto-generated expiry alerts for driver docs, vehicle docs, and maintenance schedules (30-day/14-day thresholds).
- Real-time location tracking with map view (React Leaflet).
- Messaging system: broadcast and direct channels with audio support.
- Tenant onboarding wizard for new fleet operators.
- Custom tenant branding: logo, colors, slogan applied dynamically from `TenantLicense`.
- Billing & license management panel (Stripe integration).
- CSV data import utility.
- Driver portal: dedicated `/driver/*` routes for driver role (home, profile, trips, messages).
- Dark mode support via next-themes.
- Super Admin panel: platform owner can manage all tenants, plans, and statuses.
- Danger Zone: tenant ownership delegation and tenant deletion with confirmation.
- RLS security hardening (4 separate "Apply RLS security recommendations" commits on 2026-05-26 to 2026-05-27).
