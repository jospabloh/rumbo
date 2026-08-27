import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

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

    const tenantId = user.data?.tenant_id;
    if (!tenantId) return Response.json({ error: 'Sin tenant asignado' }, { status: 400 });

    const svc = base44.asServiceRole;

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
