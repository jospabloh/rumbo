import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * joinTenant — un usuario autenticado se une a un tenant existente con su código de unión.
 *
 * Por qué es una función de servidor (service role) y no se hace desde el cliente:
 *   - Las RLS de TenantLicense solo dejan LEER el tenant a su owner o a quien ya es
 *     miembro. Un usuario nuevo todavía no es miembro, así que no puede buscar el tenant
 *     por código desde el cliente (problema huevo-gallina). El service role sí puede.
 *   - Escribir members[] requiere ser owner/admin del tenant; el que se une no lo es.
 *     El service role hace el alta de forma controlada y auditable.
 *
 * Seguridad:
 *   - El código es la llave compartida del tenant; se compara normalizado (sin espacios,
 *     guiones ni mayúsculas) para evitar fallos de tecleo, pero exige coincidencia exacta.
 *   - El que se une entra con el ROL DE MENOR PRIVILEGIO ('driver'): solo ve las vistas
 *     /driver/*. El admin del tenant lo promueve después si corresponde. Así, aunque el
 *     código se filtre, nadie obtiene acceso administrativo con solo conocerlo.
 *   - No se puede unir a un tenant cancelado/suspendido.
 *   - El owner de la app no se une a tenants por código (gestiona licencias).
 *   - tenant_id / write_access del perfil se persisten server-side (write:false en RLS),
 *     consistente con resolveTenant.
 */

const DEFAULT_JOIN_ROLE = 'driver';

function normalizeCode(raw: string): string {
  if (!raw) return '';
  let s = String(raw).toUpperCase().replace(/[\s_-]+/g, '');
  if (s.startsWith('RUMBO')) s = s.slice(5);
  return s ? `RUMBO-${s}` : '';
}

function isJoinable(tenant: any): boolean {
  if (!tenant) return false;
  // Bloquea unión a tenants apagados por el owner de la app.
  if (tenant.status === 'cancelled' || tenant.status === 'suspended' || tenant.status === 'expired') return false;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(body?.code || '');
    if (!code || code.length < 8) {
      return Response.json({ error: 'Código inválido.' }, { status: 400 });
    }

    const email = (user.email || '').toLowerCase();
    const svc = base44.asServiceRole;

    // El owner de la app gestiona licencias, no se une por código.
    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    if (appOwnerEmail && email === appOwnerEmail) {
      return Response.json({ error: 'El owner de la app no se une a tenants por código.' }, { status: 403 });
    }

    const tenants = await svc.entities.TenantLicense.list('-created_date', 1000);

    // Busca el tenant cuyo join_code normalizado coincide exactamente.
    const tenant = tenants.find((t) => normalizeCode(t.join_code || '') === code) || null;
    if (!tenant) {
      return Response.json({ error: 'No encontramos ninguna organización con ese código.' }, { status: 404 });
    }
    if (!isJoinable(tenant)) {
      return Response.json({ error: 'Esta organización no está disponible para unirse en este momento.' }, { status: 403 });
    }

    // Si el usuario ya pertenece a otro tenant, no lo movemos sin querer.
    const existingTenantId = user.data?.tenant_id || null;
    if (existingTenantId && existingTenantId !== tenant.id) {
      return Response.json({
        error: 'Ya perteneces a otra organización. Sal de ella antes de unirte a una nueva.',
      }, { status: 409 });
    }

    // Alta idempotente en members[] (no duplica si ya estaba, p. ej. lo invitaron por correo).
    const members = Array.isArray(tenant.members) ? tenant.members : [];
    const already = members.find((m) => (m.email || '').toLowerCase() === email);
    if (!already) {
      const newMember = {
        name: user.full_name || '',
        email,
        role: DEFAULT_JOIN_ROLE,
      };
      await svc.entities.TenantLicense.update(tenant.id, { members: [...members, newMember] });
    }

    // Vincula el perfil con el tenant (server-authoritative). El rol solo se asigna en el
    // primer enganche; si ya era miembro con un rol asignado por el admin, se respeta.
    const role = already?.role || DEFAULT_JOIN_ROLE;
    const patch: Record<string, unknown> = {};
    if (user.data?.tenant_id !== tenant.id) patch.tenant_id = tenant.id;
    if (!existingTenantId && user.role !== role) patch.role = role;
    if ((user.data?.write_access || 'enabled') !== 'enabled') patch.write_access = 'enabled';
    if (Object.keys(patch).length) {
      await svc.entities.User.update(user.id, patch);
    }

    return Response.json({
      ok: true,
      tenant_id: tenant.id,
      role,
      tenant: {
        id: tenant.id,
        tenant_name: tenant.tenant_name,
        slogan: tenant.slogan,
        logo_url: tenant.logo_url,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
