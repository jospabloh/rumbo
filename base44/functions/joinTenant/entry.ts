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
 *
 * UNIRSE POR CÓDIGO ES UNA SOLICITUD, NO UN ACCESO (2026-09-30). Redimir el
 * código ya no escribe members[] ni el tenant del perfil: crea una `JoinRequest`
 * pendiente (entidad service-role-only) y el solicitante no ve ningún dato de la
 * organización mientras espera. El owner/admin la aprueba eligiendo el rol, o la
 * rechaza, desde Administración (`manageMember`: listRequests / approveRequest /
 * rejectRequest). Único atajo: quien YA está en members[] (un admin lo invitó por
 * correo) cuenta como pre-aprobado y se engancha en su siguiente resolveTenant.
 * Acciones extra de esta función (sin código): `cancel` (el solicitante retira o
 * descarta su solicitud) y `status`.
 *
 * UN USUARIO, UN TENANT: unirse por código se rechaza con 409 si el caller ya
 * pertenece a otra organización. Durante un tiempo esa puerta estuvo abierta,
 * apoyada en un selector de organización que permitía volver a la anterior; ese
 * selector se retiró (nunca funcionó en producción), así que sin la puerta unirse
 * a una segunda organización dejaría la primera inalcanzable. La pertenencia vive
 * en `TenantLicense.members[]` y el binding activo en `data.tenant_id`; darse de
 * baja de una organización es cosa de su administrador (`manageMember`).
 */

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
    const action = typeof body?.action === 'string' ? body.action : 'join';
    if (!['join', 'cancel', 'status'].includes(action)) {
      return Response.json({ error: 'Acción inválida.' }, { status: 400 });
    }

    const email = (user.email || '').toLowerCase();
    const svc = base44.asServiceRole;

    // Relectura fresca del propio perfil — nunca `user.data` de auth.me(), que
    // puede reconstruir `.data` contaminado por restos de campos en la raíz del
    // documento (mismo bug encontrado y corregido en switchTenant/resolveTenant,
    // 2026-09-03: ver el comentario de esas dos funciones).
    const selfRows = await svc.entities.User.filter({ id: user.id });
    const self = Array.isArray(selfRows) ? selfRows[0] : selfRows;
    const selfData = userData(self);

    // Solicitudes propias, siempre por el id de la sesión (nunca del cuerpo).
    const ownRequests = async () => {
      const rows = await svc.entities.JoinRequest.filter({ user_id: user.id });
      return Array.isArray(rows) ? rows : [];
    };

    if (action === 'cancel') {
      // Retira una solicitud pendiente o descarta una rechazada. No toca acceso.
      for (const r of await ownRequests()) {
        try { await svc.entities.JoinRequest.delete(r.id); } catch { /* best-effort */ }
      }
      return Response.json({ ok: true, cancelled: true });
    }

    if (action === 'status') {
      const mine = (await ownRequests())[0] || null;
      return Response.json({ ok: true, request: mine ? { id: mine.id, status: mine.status, target_tenant_id: mine.target_tenant_id } : null });
    }

    const code = normalizeCode(body?.code || '');
    if (!code || code.length < 8) {
      return Response.json({ error: 'Código inválido.' }, { status: 400 });
    }

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

    // UN USUARIO, UN TENANT: quien ya pertenece a una organización no puede unirse a
    // otra. Sin esta puerta, redimir un código movería el `tenant_id` activo y la
    // organización anterior quedaría inalcanzable — no hay selector que permita
    // volver a ella. Unirse a la MISMA a la que ya perteneces sigue siendo
    // idempotente (cae por debajo y no duplica la fila en members[]).
    if (selfData?.tenant_id && selfData.tenant_id !== tenant.id) {
      return Response.json({
        error: 'Ya perteneces a otra organización. Pide a un administrador que te dé de baja antes de unirte a esta.',
      }, { status: 409 });
    }

    // Pre-aprobado: un admin ya lo invitó por correo (members[]). No hay nada que
    // aprobar; resolveTenant lo engancha con el rol que el admin eligió. El
    // cliente solo necesita recargar.
    const members = Array.isArray(tenant.members) ? tenant.members : [];
    const already = members.find((m) => (m.email || '').toLowerCase() === email);
    if (already || selfData?.tenant_id === tenant.id) {
      return Response.json({
        ok: true,
        status: 'approved',
        tenant: { id: tenant.id, tenant_name: tenant.tenant_name },
      });
    }

    // Una sola solicitud viva por persona. Otra pendiente hacia OTRA organización
    // se cancela primero (no hay forma de tener dos); hacia la misma es idempotente.
    const existing = await ownRequests();
    const pendingSame = existing.find((r: any) => r.status === 'pending' && r.target_tenant_id === tenant.id);
    if (pendingSame) {
      return Response.json({
        ok: true,
        status: 'pending',
        request_id: pendingSame.id,
        tenant: { id: tenant.id, tenant_name: tenant.tenant_name },
      });
    }
    const pendingOther = existing.find((r: any) => r.status === 'pending');
    if (pendingOther) {
      return Response.json({
        error: 'Ya tienes una solicitud pendiente en otra organización. Cancélala antes de pedir unirte a esta.',
      }, { status: 409 });
    }
    // Solicitudes rechazadas anteriores: se limpian para no acumular filas.
    for (const r of existing) {
      try { await svc.entities.JoinRequest.delete(r.id); } catch { /* best-effort */ }
    }

    // Nombre y correo salen de la sesión, no del cuerpo. target_tenant_id sale del
    // tenant que el CÓDIGO resolvió aquí, no de un id del cliente.
    const created = await svc.entities.JoinRequest.create({
      user_id: user.id,
      email,
      name: user.full_name || '',
      target_tenant_id: tenant.id,
      status: 'pending',
      requested_at: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      status: 'pending',
      request_id: created?.id || null,
      tenant: { id: tenant.id, tenant_name: tenant.tenant_name },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
