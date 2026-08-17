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
 *   - Rate limit (audit/rumbo-full-review): sin él, un atacante autenticado podía
 *     probar códigos sin límite. El espacio de códigos (32^6 ≈ 1.07 mil millones)
 *     hace el fuerza-bruta impráctico por sí solo, pero esto añade una capa de
 *     defensa (JoinAttempt, ledger persistente — ver ese archivo) por si el
 *     espacio de códigos cambia o un atacante controla muchas cuentas.
 */

const DEFAULT_JOIN_ROLE = 'driver';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const RATE_LIMIT_MAX_ATTEMPTS = 10; // per user, per window

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

// Borra intentos fuera de la ventana — igual que pruneReplayStore en acaciaControl,
// mantiene la entidad chica. Best-effort: si falla, el rate limit sigue funcionando
// (solo se acumulan filas de más, no se abre el candado).
async function pruneOldAttempts(svc: any, now: number): Promise<void> {
  try {
    const stale = await svc.entities.JoinAttempt.filter({ attempted_at: { $lt: now - RATE_LIMIT_WINDOW_MS } });
    for (const row of stale) {
      try { await svc.entities.JoinAttempt.delete(row.id); } catch { /* best-effort cleanup */ }
    }
  } catch { /* best-effort cleanup */ }
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

    // Rate limit: cuenta los intentos recientes de ESTE usuario antes de tocar el
    // código o escanear tenants. Se registra el intento aunque el código termine
    // siendo inválido — es la búsqueda por código lo que se limita, no solo los
    // uniones exitosas.
    const now = Date.now();
    await pruneOldAttempts(svc, now);
    const attempts = await svc.entities.JoinAttempt.filter({ user_id: user.id });
    const recentAttempts = attempts.filter((a: any) => now - a.attempted_at < RATE_LIMIT_WINDOW_MS);
    if (recentAttempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
      return Response.json({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }, { status: 429 });
    }
    await svc.entities.JoinAttempt.create({ user_id: user.id, attempted_at: now });

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
