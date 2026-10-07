import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Los campos propios de User (tenant_id, write_access, driver_profile_id,
// suspended) son campos de la RAÍZ del registro: es lo que la RLS lee como
// `{{user.data.X}}`. De 2026-08-31 a 2026-10-07 las funciones los escribían
// dentro de un objeto `data`, que el esquema no tiene, y la plataforma lo guardó
// como un campo suelto llamado `data` que la RLS nunca ve. Se lee solo como
// respaldo para perfiles de esa época; se escribe siempre en la raíz.
const USER_FIELDS = ['tenant_id', 'write_access', 'driver_profile_id', 'suspended'];
function userData(u: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of USER_FIELDS) out[k] = u?.[k] !== undefined ? u[k] : u?.data?.[k];
  return out;
}

/**
 * exportTenantData — "Descargar mis datos" para el módulo 7 (cuenta y zona
 * de peligro) del estándar de portafolio. DangerZone.jsx ya tenía delegar
 * ownership + eliminar tenant, pero no había forma de exportar los datos
 * antes de eliminarlos.
 *
 * Corre con service role para leer todas las entidades operativas del
 * tenant sin depender de las RLS de cada una — pero cada lectura está
 * explícitamente filtrada por tenant_id, nunca cruza tenants. Solo
 * admin/owner del tenant (mismo gate que DangerZone) puede exportar.
 */

const TENANT_ENTITIES = [
  'Vehicle', 'Driver', 'DriverDocument', 'Trip', 'Maintenance', 'Part',
  'FuelLog', 'Fine', 'InsuranceClaim', 'Alert', 'Expense', 'RentCharge',
  'VehicleDocument', 'UnitDayNote', 'DashboardUnitPref',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;
    if (role !== 'owner' && role !== 'admin') {
      return Response.json({ error: 'No autorizado' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    // Relectura fresca del propio perfil — nunca `user.data` de auth.me(),
    // que puede reconstruirse contaminado por restos de campos en la raíz
    // del documento (mismo bug de switchTenant/resolveTenant, 2026-09-03).
    const selfRows = await svc.entities.User.filter({ id: user.id });
    const self = Array.isArray(selfRows) ? selfRows[0] : selfRows;
    const tenantId = userData(self).tenant_id;
    if (!tenantId) return Response.json({ error: 'Sin tenant asignado' }, { status: 400 });

    const tenant = await svc.entities.TenantLicense.get(tenantId).catch(() => null);
    if (!tenant) return Response.json({ error: 'Tenant no encontrado' }, { status: 404 });

    const data: Record<string, unknown[]> = {};
    for (const entity of TENANT_ENTITIES) {
      try {
        data[entity] = await svc.entities[entity].filter({ tenant_id: tenantId });
      } catch (e) {
        data[entity] = [];
        console.error(`[exportTenantData] ${entity} failed: ${(e as Error).message}`);
      }
    }

    return Response.json({
      ok: true, // for src/lib/invokeFunction.js's invokeOkFunction() — success is the pre-existing field this app's own DangerZone.jsx checked before the migration to that helper.
      success: true,
      exported_at: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        tenant_name: tenant.tenant_name,
        plan: tenant.plan,
        status: tenant.status,
      },
      data,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
