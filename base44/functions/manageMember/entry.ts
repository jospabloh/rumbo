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
 *   - SOLICITUDES DE UNIÓN (2026-09-30) — 'listUsers' (miembros del tenant) / 'listRequests' / 'approveRequest' /
 *     'rejectRequest'. Unirse con el código deja una JoinRequest pendiente (ver
 *     joinTenant); aquí es donde un owner/admin la resuelve. Reglas: el tenant del
 *     caller sale de su perfil releído (nunca del cuerpo); la solicitud se relee y
 *     se compara SU `target_tenant_id` almacenado contra ese tenant (una ajena y una
 *     inexistente responden igual: 404, sin oráculo); el rol elegido va contra una
 *     lista blanca que NUNCA incluye 'owner' (transferir propiedad es
 *     delegateOwnership); y solo aprobar escribe members[] y el perfil del usuario.
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

// Roles que un admin puede asignar al aprobar. Mismo conjunto que manageRole
// (VALID_ROLES) MENOS 'owner': la propiedad solo se mueve con delegateOwnership.
// src/lib/joinRequests.js espeja esta lista y un test la compara.
const ASSIGNABLE_ROLES = ['admin', 'dispatcher', 'mechanic', 'driver', 'investor', 'user'];
const REQUEST_ACTIONS = ['listRequests', 'approveRequest', 'rejectRequest'];

/**
 * Resuelve solicitudes de unión. `svc` = service role; `tenantId` ya viene del
 * perfil releído del caller, que ya se comprobó owner/admin.
 */
async function handleRequests(svc: any, caller: any, tenantId: string, body: any): Promise<Response> {
  const { action } = body;

  if (action === 'listRequests') {
    const rows = await svc.entities.JoinRequest.filter({ target_tenant_id: tenantId, status: 'pending' });
    const requests = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      id: r.id,
      name: r.name || '',
      email: r.email || '',
      requested_at: r.requested_at || null,
    }));
    return Response.json({ ok: true, requests });
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  if (!requestId) return Response.json({ error: 'Solicitud inválida.' }, { status: 400 });

  // Se relee y se compara el tenant ALMACENADO: una solicitud de otra
  // organización responde exactamente igual que una que no existe.
  const request = await svc.entities.JoinRequest.get(requestId).catch(() => null);
  if (!request || request.target_tenant_id !== tenantId) {
    return Response.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
  }
  if (request.status !== 'pending') {
    return Response.json({ error: 'Esa solicitud ya fue resuelta.' }, { status: 409 });
  }

  if (action === 'rejectRequest') {
    await svc.entities.JoinRequest.update(request.id, {
      status: 'rejected',
      decided_by: (caller.email || '').toLowerCase(),
      decided_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, action, rejected: true });
  }

  // approveRequest
  const role = body.role;
  if (typeof role !== 'string' || !ASSIGNABLE_ROLES.includes(role)) {
    return Response.json({ error: 'Elige un rol válido para la persona.' }, { status: 400 });
  }

  const tenant = await svc.entities.TenantLicense.get(tenantId).catch(() => null);
  if (!tenant) return Response.json({ error: 'Organización no encontrada.' }, { status: 404 });

  const target = await svc.entities.User.get(request.user_id).catch(() => null);
  if (!target) {
    await svc.entities.JoinRequest.delete(request.id).catch(() => {});
    return Response.json({ error: 'Esa cuenta ya no existe.' }, { status: 404 });
  }
  const targetData = userData(target);

  // UN USUARIO, UN TENANT: si ya se enganchó a otra organización mientras
  // esperaba, aprobar la dejaría inalcanzable. La solicitud se cierra sin
  // efecto. Si ya está en ESTA (p. ej. lo invitaron aparte), tampoco hay nada
  // que escribir.
  if (targetData.tenant_id && targetData.tenant_id !== tenantId) {
    await svc.entities.JoinRequest.delete(request.id).catch(() => {});
    return Response.json({ error: 'Esa persona ya pertenece a otra organización.' }, { status: 409 });
  }
  const targetEmail = (target.email || '').toLowerCase();
  const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
  // Base44 rejects role changes on the app owner even as service role, so the
  // role write is skipped for that account (the check below also refuses it).
  const isAppOwnerTarget = !!targetEmail && targetEmail === appOwnerEmail;

  // Role write, in its OWN call (atomic update: mixed with `data` a rejection
  // would lose the tenant). Returns the error message, or null when applied /
  // nothing to do. A failure must NOT consume the request.
  const applyRole = async (): Promise<string | null> => {
    if (isAppOwnerTarget || target.role === role) return null;
    try {
      await svc.entities.User.update(target.id, { role });
      return null;
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`[manageMember] role update rejected for ${target.id}: ${msg}`);
      return msg;
    }
  };
  const roleFailed = () => Response.json(
    { error: 'No se pudo asignar el rol. La solicitud sigue pendiente; inténtalo de nuevo.' },
    { status: 502 },
  );

  if (targetData.tenant_id === tenantId) {
    // Retry after a failed role write (or invited separately): reconcile the
    // stored role with the approver's choice before consuming the request.
    if (await applyRole()) return roleFailed();
    await svc.entities.JoinRequest.delete(request.id).catch(() => {});
    return Response.json({ ok: true, action, approved: true, already_member: true });
  }

  if (targetEmail && targetEmail === appOwnerEmail) {
    return Response.json({ error: 'El owner de la plataforma no se une a organizaciones.' }, { status: 403 });
  }
  if (targetEmail && targetEmail === (tenant.owner_email || '').toLowerCase()) {
    await svc.entities.JoinRequest.delete(request.id).catch(() => {});
    return Response.json({ error: 'Esa persona ya es la propietaria de la organización.' }, { status: 409 });
  }

  // 1) members[] primero: si algo falla después, resolveTenant reconoce a la
  //    persona por aquí con este mismo rol (aprobación ya concedida), así que el
  //    estado no se queda a medias.
  //    Base44 has no atomic append: re-read the tenant right before the write
  //    and merge into that fresh list, so a concurrent approve/invite/remove
  //    between our first read and here is not overwritten (the window is
  //    narrowed, not closed).
  const freshTenant = await svc.entities.TenantLicense.get(tenantId).catch(() => null) || tenant;
  const members = Array.isArray(freshTenant.members) ? freshTenant.members : [];
  const idx = members.findIndex((m: any) => (m.email || '').toLowerCase() === targetEmail);
  const entry = { name: target.full_name || request.name || '', email: targetEmail, role };
  const nextMembers = idx >= 0
    ? members.map((m: any, i: number) => (i === idx ? { ...m, ...entry } : m))
    : [...members, entry];
  await svc.entities.TenantLicense.update(tenantId, { members: nextMembers });

  // 2) Perfil: tenant_id / write_access / driver_profile_id bajo `data`.
  let driverProfileId: string | null = null;
  try {
    const drivers = await svc.entities.Driver.filter({ profile_id: target.id });
    const drv = Array.isArray(drivers) ? (drivers.find((d: any) => d.tenant_id === tenantId) || null) : null;
    driverProfileId = drv?.id || null;
  } catch (_e) { /* sin registro Driver vinculado */ }
  await svc.entities.User.update(target.id, {
    tenant_id: tenantId,
    driver_profile_id: driverProfileId,
    write_access: computeWriteAccess(tenant),
  });

  // 3) Rol en su PROPIA llamada (la plataforma rechaza tocar el rol del owner de
  //    la app y el update es atómico: mezclado con `data` perdería el tenant).
  if (await applyRole()) return roleFailed();
  const roleApplied = isAppOwnerTarget ? target.role : role;

  await svc.entities.JoinRequest.delete(request.id).catch(() => {});
  return Response.json({ ok: true, action, approved: true, role: roleApplied });
}

// Los campos custom de User (tenant_id) viven bajo `data`, y la plataforma no
// los filtra con `User.filter({tenant_id})` ni con `{'data.tenant_id'}`: devuelve
// siempre []. Se lista y se filtra en memoria (QA en vivo 2026-10-01).
async function usersOfTenant(svc: any, tenantId: string): Promise<any[]> {
  const rows = await svc.entities.User.list('-created_date', 5000);
  return (Array.isArray(rows) ? rows : []).filter((u: any) => (userData(u).tenant_id || null) === tenantId);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['owner', 'admin'].includes(caller.role)) {
      return Response.json({ error: 'Solo un administrador puede gestionar usuarios.' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    // Relectura fresca del propio perfil — nunca `caller.data` de auth.me(), que
    // puede reconstruir `.data` contaminado por restos de campos en la raíz del
    // documento (mismo bug encontrado y corregido en switchTenant/resolveTenant/
    // joinTenant, 2026-09-03).
    const callerSelfRows = await svc.entities.User.filter({ id: caller.id });
    const callerSelf = Array.isArray(callerSelfRows) ? callerSelfRows[0] : callerSelfRows;
    const tenantId = userData(callerSelf).tenant_id || null;
    if (!tenantId) return Response.json({ error: 'No perteneces a ninguna organización.' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { action, userId } = body;

    // Lista de usuarios del tenant del caller (owner/admin). La UI ya no puede
    // leer `User.filter` (403 "Only collaborators can view the list of users"),
    // así que el panel de Administración los pide aquí, por service role.
    if (action === 'listUsers') {
      const rows = await usersOfTenant(svc, tenantId);
      const users = (Array.isArray(rows) ? rows : []).map((u: any) => {
        const d = userData(u);
        return {
          id: u.id,
          email: u.email || '',
          full_name: u.full_name || '',
          display_name: u.display_name ?? u.data?.display_name ?? '',
          role: u.role || 'user',
          suspended: !!d.suspended,
          write_access: d.write_access ?? u.write_access ?? null,
          owner_group_id: d.owner_group_id ?? u.owner_group_id ?? '',
          created_date: u.created_date || null,
        };
      });
      return Response.json({ ok: true, users });
    }

    if (REQUEST_ACTIONS.includes(action)) {
      return await handleRequests(svc, caller, tenantId, body);
    }

    if (!userId || !['suspend', 'reactivate', 'remove'].includes(action)) {
      return Response.json({ error: 'Acción o usuario inválido.' }, { status: 400 });
    }
    if (userId === caller.id) {
      return Response.json({ error: 'No puedes aplicarte esta acción a ti mismo.' }, { status: 400 });
    }

    const target = await svc.entities.User.get(userId).catch(() => null);
    if (!target) return Response.json({ error: 'Usuario no encontrado.' }, { status: 404 });

    // El objetivo debe pertenecer al mismo tenant que el administrador.
    if ((userData(target).tenant_id || null) !== tenantId) {
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
    // `target.data` viene de un `User.get()` por service role (no de auth.me()),
    // así que es confiable; se incluye completo para que `data:{...}` no borre
    // tenant_id/driver_profile_id del objetivo si la plataforma reemplaza el
    // subdocumento entero en vez de mezclarlo.
    if (action === 'suspend') {
      await svc.entities.User.update(userId, { suspended: true, write_access: 'blocked' });
      return Response.json({ ok: true, action, suspended: true });
    }

    if (action === 'reactivate') {
      const writeAccess = computeWriteAccess(tenant);
      await svc.entities.User.update(userId, { suspended: false, write_access: writeAccess });
      return Response.json({ ok: true, action, suspended: false, write_access: writeAccess });
    }

    // action === 'remove': desliga del tenant sin borrar la cuenta.
    if (tenant && Array.isArray(tenant.members)) {
      const members = tenant.members.filter((m) => (m.email || '').toLowerCase() !== targetEmail);
      if (members.length !== tenant.members.length) {
        await svc.entities.TenantLicense.update(tenant.id, { members });
      }
    }
    // El rol va en su PROPIA llamada, nunca junto a `data`: la plataforma rechaza
    // cambiar el rol del owner de la app aunque sea service role, y el update es
    // atómico — mezclados, quitar del tenant al owner de la app no desligaría nada.
    await svc.entities.User.update(userId, {
      tenant_id: null,
      suspended: false,
      write_access: 'enabled',
      driver_profile_id: null,
    });
    try {
      await svc.entities.User.update(userId, { role: 'user' });
    } catch (e) {
      console.error(`[manageMember] role update rejected for ${userId}: ${(e as Error).message}`);
    }
    return Response.json({ ok: true, action, removed: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
