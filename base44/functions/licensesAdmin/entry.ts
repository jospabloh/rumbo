import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * licensesAdmin — panel de licencias del owner de la app.
 *
 * Acceso EXCLUSIVO del owner de la app (APP_OWNER_EMAIL). Es la única excepción
 * legítima cross-tenant: corre con service role para ver y administrar TODAS las
 * licencias. Las RLS por tenant siguen intactas para todos los demás.
 *
 * Acciones:
 *   - list:        devuelve todas las licencias con su info relevante.
 *   - renew:       confirma pago y extiende current_period_end (mensual/anual).
 *   - set_status:  override manual (active | suspended | cancelled).
 */

function extendFrom(currentEnd: string | undefined, cycle: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = currentEnd ? new Date(currentEnd) : today;
  // Si la licencia aún está vigente, se extiende desde su fin; si ya venció, desde hoy.
  const base = end > today ? end : today;
  const next = new Date(base);
  if (cycle === 'annual') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || 'h.josepablo@gmail.com').toLowerCase();
    if ((user.email || '').toLowerCase() !== appOwnerEmail) {
      return Response.json({ error: 'Forbidden: app owner only' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'list') {
      const tenants = await svc.entities.TenantLicense.list('-created_date', 1000);
      return Response.json({ tenants });
    }

    if (action === 'renew') {
      const { tenantId, cycle = 'monthly', plan } = body;
      if (!tenantId) return Response.json({ error: 'tenantId requerido' }, { status: 400 });
      const tenant = (await svc.entities.TenantLicense.list('-created_date', 1000)).find((t) => t.id === tenantId);
      if (!tenant) return Response.json({ error: 'Tenant no encontrado' }, { status: 404 });
      const current_period_end = extendFrom(tenant.current_period_end, cycle);
      const patch: Record<string, unknown> = {
        current_period_end,
        last_payment_at: new Date().toISOString().slice(0, 10),
        billing_cycle: cycle,
        status: 'active',
      };
      if (plan) patch.plan = plan;
      const updated = await svc.entities.TenantLicense.update(tenantId, patch);
      return Response.json({ tenant: updated });
    }

    if (action === 'set_status') {
      const { tenantId, status } = body;
      if (!tenantId || !['active', 'suspended', 'cancelled', 'expired'].includes(status)) {
        return Response.json({ error: 'tenantId y status válido requeridos' }, { status: 400 });
      }
      const updated = await svc.entities.TenantLicense.update(tenantId, { status });
      return Response.json({ tenant: updated });
    }

    return Response.json({ error: 'Acción desconocida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
