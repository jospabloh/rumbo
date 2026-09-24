// guardedEntityWrite — server-side enforcement of the granular per-tenant
// module permissions (`TenantLicense.permissions_config`) documented in
// docs/permissions_matrix.md as gap "G1": "These granular permissions
// currently control the UI only... Backend entity RLS enforces the
// role-level access... but does not yet read permissions_config."
//
// Entity RLS already gates every operational write by ROLE (owner/admin/
// dispatcher/mechanic, plus a handful of hardcoded self-record branches for
// the driver role — see below) and by `data.write_access` (the license
// billing gate, set by resolveTenant). What RLS cannot see is the PER-TENANT
// override an admin sets via the Permisos por Rol panel (PermissionsPanel.jsx)
// — e.g. an admin who revokes a dispatcher's "Rentas:create" via
// permissions_config. RLS still has `role:dispatcher` in RentCharge.create's
// $or, so a direct SDK call from that dispatcher would still succeed even
// though the tenant's own admin explicitly denied it. This function is the
// sanctioned write path for the 14 module-scoped entities, closing that gap.
//
// mirrors src/lib/modulePerms.js (`DEFAULT_PERMISSIONS`, `defaultPerm`,
// `moduleCan`) — the exact same role/module/action defaults and override
// resolution, kept in sync by hand.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Entity -> module key (docs/permissions_matrix.md's 14-module granular
// matrix). Only entities gated by that matrix are handled here — TenantLicense,
// User, AppSession, DashboardUnitPref, Catalog, UsefulLink are page/role-gated
// only (owner/admin, or self-scoped personal data with no configurable
// per-tenant override), same shape of investigated-and-excluded finding as
// jospabloh/liuma's AppSession.
const ENTITY_MODULE: Record<string, string> = {
  Vehicle: 'vehicles',
  VehicleDocument: 'vehicles',
  Driver: 'drivers',
  DriverDocument: 'drivers',
  DriverPrivateNote: 'drivers',
  Trip: 'trips',
  Maintenance: 'maintenance',
  Part: 'parts',
  FuelLog: 'fuel',
  Fine: 'fines',
  InsuranceClaim: 'insurance',
  Alert: 'alerts',
  Message: 'messages',
  Channel: 'messages',
  LocationRequest: 'location',
  Expense: 'financial',
  RentCharge: 'rentas',
  // UnitDayNote has no dedicated module of its own -- it's created from the
  // Reportes drill-down, and "reports" is owner/admin-only (view-only) for
  // every configurable role, so mapping it here reproduces that page-level
  // gate at the write layer.
  UnitDayNote: 'reports',
};

// === mirrors src/lib/modulePerms.js verbatim -- keep both in sync by hand ===
const DEFAULT_PERMISSIONS: Record<string, Record<string, Record<string, boolean>>> = {
  dispatcher: {
    vehicles:    { view: true,  create: true,  edit: true,  delete: false, pause: false },
    drivers:     { view: true,  create: true,  edit: true,  delete: false, pause: true  },
    trips:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    maintenance: { view: true,  create: false, edit: false, delete: false, pause: false },
    parts:       { view: false, create: false, edit: false, delete: false, pause: false },
    fuel:        { view: true,  create: true,  edit: true,  delete: false, pause: false },
    fines:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    insurance:   { view: true,  create: true,  edit: true,  delete: false, pause: false },
    alerts:      { view: true,  create: true,  edit: true,  delete: false, pause: false },
    messages:    { view: true,  create: true,  edit: true,  delete: false, pause: false },
    location:    { view: true,  create: false, edit: false, delete: false, pause: false },
    financial:   { view: false, create: false, edit: false, delete: false, pause: false },
    rentas:      { view: true,  create: true,  edit: true,  delete: false, pause: false },
    reports:     { view: false, create: false, edit: false, delete: false, pause: false },
  },
  mechanic: {
    vehicles:    { view: true,  create: false, edit: true,  delete: false, pause: true  },
    drivers:     { view: false, create: false, edit: false, delete: false, pause: false },
    trips:       { view: false, create: false, edit: false, delete: false, pause: false },
    maintenance: { view: true,  create: true,  edit: true,  delete: false, pause: false },
    parts:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    fuel:        { view: false, create: false, edit: false, delete: false, pause: false },
    fines:       { view: false, create: false, edit: false, delete: false, pause: false },
    insurance:   { view: false, create: false, edit: false, delete: false, pause: false },
    alerts:      { view: false, create: false, edit: false, delete: false, pause: false },
    messages:    { view: false, create: false, edit: false, delete: false, pause: false },
    location:    { view: false, create: false, edit: false, delete: false, pause: false },
    financial:   { view: false, create: false, edit: false, delete: false, pause: false },
    rentas:      { view: false, create: false, edit: false, delete: false, pause: false },
    reports:     { view: false, create: false, edit: false, delete: false, pause: false },
  },
  driver: {
    vehicles:    { view: true,  create: false, edit: false, delete: false, pause: false },
    drivers:     { view: true,  create: false, edit: true,  delete: false, pause: false },
    trips:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    maintenance: { view: false, create: false, edit: false, delete: false, pause: false },
    parts:       { view: false, create: false, edit: false, delete: false, pause: false },
    fuel:        { view: true,  create: true,  edit: false, delete: false, pause: false },
    fines:       { view: true,  create: false, edit: false, delete: false, pause: false },
    insurance:   { view: true,  create: false, edit: false, delete: false, pause: false },
    alerts:      { view: true,  create: false, edit: false, delete: false, pause: false },
    messages:    { view: true,  create: true,  edit: false, delete: false, pause: false },
    location:    { view: false, create: false, edit: false, delete: false, pause: false },
    financial:   { view: false, create: false, edit: false, delete: false, pause: false },
    rentas:      { view: false, create: false, edit: false, delete: false, pause: false },
    reports:     { view: false, create: false, edit: false, delete: false, pause: false },
  },
};

const NEW_PERMISSION_DEFAULT = { view: true, create: false, edit: false, delete: false, pause: false };

function defaultPerm(role: string, mod: string, action: string): boolean {
  if (role === 'owner' || role === 'admin') return true;
  const roleDefaults = DEFAULT_PERMISSIONS[role];
  if (!roleDefaults) return false;
  const moduleDefaults = roleDefaults[mod] ?? NEW_PERMISSION_DEFAULT;
  return !!(moduleDefaults as Record<string, boolean>)[action];
}

function moduleCan(config: any, role: string, mod: string, action: string): boolean {
  if (!role) return false;
  if (role === 'owner' || role === 'admin') return true;
  const fromConfig = config?.[role]?.[mod]?.[action];
  if (typeof fromConfig === 'boolean') return fromConfig;
  return defaultPerm(role, mod, action);
}
// === end mirror of src/lib/modulePerms.js ===

const ACTION_BY_OP: Record<string, string> = { create: 'create', update: 'edit', delete: 'delete' };

// Entities where the `driver` role writes only their OWN record, via a
// hardcoded RLS branch that exists independently of the configurable
// permissions_config (mirrors each entity's own .jsonc rls exactly — see the
// per-case comments below). asServiceRole bypasses per-record RLS, so this
// function re-derives the same restriction server-side.
type SelfScope = {
  field: string;
  compareTo: 'driver_profile_id' | 'user_id';
  requireStatus?: string;
  // Which ops this self-scope applies to -- default both. LocationRequest's
  // driver branch in its own RLS exists ONLY on update (a driver never
  // creates their own location request; a dispatcher creates it and the
  // driver later fulfills it), so restricting to ['update'] here matters:
  // without it, a driver would incorrectly pass the entity's role check on
  // create too (isDriverSelfPath would be true) even though RLS never
  // allowed that.
  ops?: Array<'create' | 'update'>;
  // On update, the ONLY fields a driver may send. asServiceRole bypasses
  // field-level RLS too, not just per-record RLS, so an entity whose .jsonc
  // locks fields to owner/admin/dispatcher must list here what its driver
  // branch can still write -- otherwise this path would hand a driver every
  // locked field. Omitted = the entity has no field locks for driver.
  writable?: string[];
};
const DRIVER_SELF_SCOPE: Record<string, SelfScope> = {
  // Trip.jsonc create/update: role in (owner,admin,dispatcher) OR data.driver_id == driver_profile_id.
  // No delete branch for driver at all (nor does any role except owner/admin
  // get Trip delete) -- ops is explicit so this self-scope never has a say
  // over delete, leaving that to moduleCan's own delete:false default alone.
  // 'trips' IS in DEFAULT_PERMISSIONS.driver (configurable), so moduleCan also applies.
  Trip: { field: 'driver_id', compareTo: 'driver_profile_id', ops: ['create', 'update'] },
  // FuelLog.jsonc create: same shape as Trip. No current call site, kept for
  // when one is added -- the entity RLS already supports it.
  FuelLog: { field: 'driver_id', compareTo: 'driver_profile_id', ops: ['create'] },
  // Driver.jsonc update: role in (...) OR data.profile_id == user.id (NOT
  // driver_profile_id -- Driver.profile_id points at the linked User, unlike
  // Trip/FuelLog's driver_id which points at the Driver record).
  // 'drivers' IS in DEFAULT_PERMISSIONS.driver, so moduleCan also applies.
  // Driver.jsonc locks every field except `phone` to owner/admin/dispatcher
  // (status, rating, referral_credit, profile_id...), so `phone` is all a
  // driver may write to their own record -- DriverProfile.jsx's only write.
  Driver: { field: 'profile_id', compareTo: 'user_id', ops: ['update'], writable: ['phone'] },
  // LocationRequest.jsonc update: role in (owner,admin,dispatcher) OR
  // (data.driver_id == driver_profile_id AND data.status == 'pending').
  // LocationRequest is a ROLE_ONLY_ENTITY (see below), so moduleCan never
  // applies to it -- only this self-scope + status check does, for driver.
  LocationRequest: { field: 'driver_id', compareTo: 'driver_profile_id', requireStatus: 'pending', ops: ['update'] },
};

function selfScopeAppliesToOp(scope: SelfScope, operation: string): boolean {
  return !scope.ops || (scope.ops as string[]).includes(operation);
}

// Message.jsonc create has NO role branch at all -- data.sender_id ==
// user.id is the ONLY create rule, for every role including owner/admin.
// Enforced unconditionally below, separately from DRIVER_SELF_SCOPE.

// Entities where the configurable permissions_config layer is NOT wired to
// anything today -- no page reads useModulePerms().can() before rendering
// their write actions (confirmed by grep across src/pages, src/components),
// so the *documented* default in DEFAULT_PERMISSIONS.location would, if
// enforced here for the first time, silently break a live feature no admin
// has ever had a reason to configure. For these entities moduleCan is
// skipped entirely and access is exactly the role set (+ driver self-scope
// where DRIVER_SELF_SCOPE has an entry) their own RLS already grants:
//   - Channel.jsonc: owner/admin/dispatcher only, no driver branch at all
//     (drivers CAN message, but not create a whole channel -- narrower than
//     'messages' module's own driver:create=true default).
//   - LocationRequest.jsonc: owner/admin/dispatcher create/update, PLUS the
//     driver-self-record update above.
const ROLE_ONLY_ENTITIES: Record<string, Set<string>> = {
  Channel: new Set(['owner', 'admin', 'dispatcher']),
  LocationRequest: new Set(['owner', 'admin', 'dispatcher']),
};

function bad(status: number, code: string, message: string): Response {
  return Response.json({ ok: false, code, error: message }, { status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return bad(401, 'UNAUTHENTICATED', 'Unauthorized');

    const body = await req.json().catch(() => ({}));
    const entity = String(body?.entity || '');
    const operation = String(body?.operation || '');
    if (!['create', 'update', 'delete'].includes(operation)) {
      return bad(400, 'BAD_OP', 'operation must be create, update or delete');
    }
    const mod = ENTITY_MODULE[entity];
    if (!mod) return bad(400, 'UNKNOWN_ENTITY', `${entity} is not guarded by this function`);

    const svc = base44.asServiceRole;

    // Authority derived entirely from the caller's own profile -- role from
    // `user.role` (a genuine top-level platform field, reliable in
    // auth.me()) and everything else from a FRESH service-role reread of the
    // caller's own User document, never from `user.data`/auth.me()'s
    // convenience `.data`, which can reconstruct itself contaminated by
    // stray root-level fields left over from pre-2026-08-31 writes (see
    // switchTenant's 2026-09-03 CORRECCIÓN comment -- this is the same write
    // gate for all 17 module-scoped entities, so trusting auth.me()'s `.data`
    // here would let a stale/contaminated tenant_id, write_access or
    // driver_profile_id silently authorize (or wrongly deny) a write instead
    // of the record actually persisted).
    const role = String(user.role || '');
    const selfRows = await svc.entities.User.filter({ id: user.id });
    const self = Array.isArray(selfRows) ? selfRows[0] : selfRows;
    const selfData = self?.data || {};
    const tenantId = selfData?.tenant_id;
    if (!tenantId) return bad(400, 'NO_TENANT', 'No tenant assigned');
    if (selfData?.write_access !== 'enabled') {
      return bad(403, 'WRITE_BLOCKED', 'Tenant write access is blocked (billing)');
    }

    const action = ACTION_BY_OP[operation];
    const selfScope = DRIVER_SELF_SCOPE[entity];
    const isDriverSelfPath = role === 'driver' && !!selfScope && selfScopeAppliesToOp(selfScope, operation);
    const roleOnly = ROLE_ONLY_ENTITIES[entity];

    if (!(role === 'owner' || role === 'admin')) {
      if (roleOnly) {
        // Role-gated only (see ROLE_ONLY_ENTITIES) -- never consult
        // permissions_config. A driver still needs to land on their own
        // self-scope path (checked below); anyone else must be in the set.
        if (!(roleOnly.has(role) || isDriverSelfPath)) {
          return bad(403, 'PERMISSION_DENIED', `Role "${role}" cannot ${operation} ${entity}`);
        }
      } else {
        const tenant = await svc.entities.TenantLicense.get(tenantId).catch(() => null);
        if (!tenant) return bad(404, 'TENANT_NOT_FOUND', 'Tenant not found');
        if (!moduleCan(tenant.permissions_config, role, mod, action)) {
          return bad(403, 'PERMISSION_DENIED', `Role "${role}" lacks ${mod}:${action}`);
        }
      }
    }

    if (operation === 'create') {
      const data: Record<string, unknown> = { ...(body.data || {}), tenant_id: tenantId };

      // Message.create: sender_id == caller, for every role (mirrors RLS's
      // only rule for this op -- no role branch exists at all).
      if (entity === 'Message') {
        data.sender_id = user.id;
      }

      if (isDriverSelfPath) {
        const driverProfileId = selfData?.driver_profile_id;
        const expected = selfScope.compareTo === 'user_id' ? user.id : driverProfileId;
        if (!expected || data[selfScope.field] !== expected) {
          return bad(403, 'NOT_YOUR_RECORD', `${entity}.${selfScope.field} must be your own`);
        }
      }

      const record = await svc.entities[entity].create(data);
      return Response.json({ ok: true, record });
    }

    // update / delete: re-read the existing record with the service role and
    // check tenant + (for driver) self-scope against what's ACTUALLY stored,
    // never against client-submitted values.
    const id = String(body?.id || '');
    if (!id) return bad(400, 'MISSING_ID', 'id required');
    const existing = await svc.entities[entity].get(id).catch(() => null);
    if (!existing || existing.tenant_id !== tenantId) {
      return bad(404, 'NOT_FOUND', 'Record not found in your tenant');
    }

    if (isDriverSelfPath) {
      const driverProfileId = selfData?.driver_profile_id;
      const expected = selfScope.compareTo === 'user_id' ? user.id : driverProfileId;
      if (!expected || existing[selfScope.field] !== expected) {
        return bad(403, 'NOT_YOUR_RECORD', `${entity}.${selfScope.field} must be your own`);
      }
      if (selfScope.requireStatus && existing.status !== selfScope.requireStatus) {
        return bad(409, 'WRONG_STATUS', `${entity} is no longer ${selfScope.requireStatus}`);
      }
    }

    if (operation === 'update') {
      const data: Record<string, unknown> = { ...(body.data || {}) };
      delete data.tenant_id; // never let a client move a record to another tenant
      if (entity === 'Message') delete data.sender_id; // never re-attribute an existing message
      if (isDriverSelfPath) {
        // The self-scope was checked against the STORED record above; the
        // patch must not move it off the driver afterwards (create already
        // enforces the same field -- this closes the update half).
        if (selfScope.field in data && data[selfScope.field] !== existing[selfScope.field]) {
          return bad(403, 'NOT_YOUR_RECORD', `${entity}.${selfScope.field} cannot be changed`);
        }
        delete data[selfScope.field];
        if (selfScope.writable) {
          const locked = Object.keys(data).filter((k) => !selfScope.writable!.includes(k));
          if (locked.length) {
            return bad(403, 'FIELD_LOCKED', `${entity}: drivers cannot write ${locked.join(', ')}`);
          }
        }
      }
      const record = await svc.entities[entity].update(id, data);
      return Response.json({ ok: true, record });
    }

    // delete
    await svc.entities[entity].delete(id);
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json({ ok: false, code: 'INTERNAL', error: (e as Error).message }, { status: 500 });
  }
});
