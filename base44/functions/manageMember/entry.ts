import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * manageMember — el admin/owner de un tenant suspende, reactiva o quita a un usuario.
 *
 * Por qué función de servidor (service role):
 *   - `write_access`, `suspended` y `tenant_id` del perfil son server-authoritative
 *     (write:false en RLS). Suspender = bloquear escritura; quitar = desligar del tenant.
 *     Nada de esto se puede hacer desde el cliente, y debe quedar auditado en un solo lugar.
 *
 * Seguridad:
 *   - Solo owner/admin del MISMO tenant que el objetivo puede actuar.
 *   - No se puede actuar sobre uno mismo (evita auto-bloqueo) ni sobre el owner del tenant
 *     (owner_email) ni sobre el owner de la app.
 *   - 'suspend' marca suspended=true y write_access='blocked'. resolveTenant respeta el
 *     flag, así que la suspensión no se revierte sola al revalidar la licencia.
 *   - 'remove' desliga al usuario (tenant_id=null), lo saca de members[] y lo baja a 'user'.
 *     No borra la cuenta: solo revoca el acceso a este tenant.
 */

function computeWriteAccess(tenant: any): 'enabled' | 'blocked' {
  if (!tenant) return 'enabled';
  if (tenant.status === 'cancelled' || tenant.status === 'suspended' || tenant.status === 'expired') return 'blocked';
  const endStr = tenant.current_period_end || tenant.trial_ends_at;
  if (!endStr) return 'enabled';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(endStr); end.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (daysLeft >= 0) return 'enabled';
  return -daysLeft <= 7 ? 'enabled' : 'blocked';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['owner', 'admin'].includes(caller.role)) {
      return Response.json({ error: 'Solo un administrador puede gestionar usuarios.' }, { status: 403 });
    }

    const tenantId = caller.data?.tenant_id || null;
    if (!tenantId) return Response.json({ error: 'No perteneces a ninguna organización.' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { action, userId } = body;
    if (!userId || !['suspend', 'reactivate', 'remove'].includes(action)) {
      return Response.json({ error: 'Acción o usuario inválido.' }, { status: 400 });
    }
    if (userId === caller.id) {
      return Response.json({ error: 'No puedes aplicarte esta acción a ti mismo.' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const target = await svc.entities.User.get(userId).catch(() => null);
    if (!target) return Response.json({ error: 'Usuario no encontrado.' }, { status: 404 });

    // El objetivo debe pertenecer al mismo tenant que el administrador.
    if ((target.data?.tenant_id || null) !== tenantId) {
      return Response.json({ error: 'Ese usuario no pertenece a tu organización.' }, { status: 403 });
    }

    const tenants = await svc.entities.TenantLicense.list('-created_date', 1000);
    const tenant = tenants.find((t) => t.id === tenantId) || null;
    const targetEmail = (target.email || '').toLowerCase();

    // Protege al owner del tenant y al owner de la app.
    const tenantOwnerEmail = (tenant?.owner_email || '').toLowerCase();
    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    if (targetEmail && (targetEmail === tenantOwnerEmail || targetEmail === appOwnerEmail)) {
      return Response.json({ error: 'No puedes modificar al propietario de la organización.' }, { status: 403 });
    }

    // suspended/write_access viven bajo `data` (así los lee auth.me()/RLS,
    // {{user.data.write_access}}) — un objeto plano los escribiría en la raíz del
    // documento y RLS seguiría viendo el valor anterior, dejando la suspensión sin
    // efecto real aunque la llamada responda ok:true.
    if (action === 'suspend') {
      await svc.entities.User.update(userId, { data: { suspended: true, write_access: 'blocked' } });
      return Response.json({ ok: true, action, suspended: true });
    }

    if (action === 'reactivate') {
      const writeAccess = computeWriteAccess(tenant);
      await svc.entities.User.update(userId, { data: { suspended: false, write_access: writeAccess } });
      return Response.json({ ok: true, action, suspended: false, write_access: writeAccess });
    }

    // action === 'remove': desliga del tenant sin borrar la cuenta.
    if (tenant && Array.isArray(tenant.members)) {
      const members = tenant.members.filter((m) => (m.email || '').toLowerCase() !== targetEmail);
      if (members.length !== tenant.members.length) {
        await svc.entities.TenantLicense.update(tenant.id, { members });
      }
    }
    await svc.entities.User.update(userId, {
      role: 'user',
      data: {
        tenant_id: null,
        suspended: false,
        write_access: 'enabled',
        driver_profile_id: null,
      },
    });
    return Response.json({ ok: true, action, removed: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
