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

## Module 3 (granular server-side permission enforcement) — deferred, tracked separately

Rumbo has **no Safe-function layer** for its 14 operational modules
(vehicles, drivers, trips, maintenance, parts, fuel, fines, insurance,
alerts, messages, location, financial, rentas, reports) — writes go directly
through `base44.entities.X.*` from the client, gated only by RLS
(`tenant_id` match + `write_access` license gate, see `resolveTenant/entry.ts`)
and client-side `permissions.js` checks, with no server-side enforcement of
the finer-grained role/action matrix in `docs/permissions_matrix.md`.
Building that layer (Safe-function equivalents per entity, mirroring
`jospabloh/stockflow`'s `base44/functions/{pettyCash,utility,
supplierPayments,catalogSettings}/` pattern) is a multi-entity, multi-file
initiative on the scale of a dedicated pass — not attempted piecemeal here.
