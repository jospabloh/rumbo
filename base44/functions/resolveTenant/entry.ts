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
 * resolveTenant — asigna y devuelve el tenant del usuario autenticado de forma robusta.
 *
 * Es la fuente de verdad del binding usuario→tenant. Corre con service role, así que no
 * depende de las RLS del cliente (que serían un problema de huevo-y-gallina: para leer su
 * licencia el usuario ya necesitaría su tenant_id).
 *
 * Resolución:
 *   1. Si ya hay tenant_id guardado en el perfil y sigue existiendo, se conserva.
 *   2. Si no, se toma el PRIMER tenant que empareja (creador, owner_email o miembro
 *      en members[]) por orden de creación descendente, y se persiste.
 *
 * SOLICITUDES (2026-09-30): unirse por código ya no da acceso, deja una
 * `JoinRequest` pendiente. Esta función NO la aprueba nunca; solo la refleja
 * (`join_request`) para que el solicitante vea "esperando aprobación" tras una
 * recarga. La única vía por la que un email entra sin aprobación aquí es
 * members[] (invitación de un admin, pre-aprobada) o ser creador/owner_email.
 *
 * UN USUARIO, UN TENANT. Un email pertenece a una sola organización a la vez: el
 * binding que esta función persiste es definitivo mientras exista, y no hay forma
 * de cambiarlo desde la app. Si alguien necesita moverse de organización, un
 * operador de plataforma lo reasigna. El selector de organización (el antiguo
 * módulo 18: `candidates`, `needs_tenant_choice` y la función `switchTenant`) se
 * retiró — nunca llegó a funcionar en producción y su ausencia es ahora el
 * contrato, no una carencia.
 *
 * En el primer enganche a un tenant persiste tenant_id (y el rol del invitado, si
 * aplica) en el perfil. En logins posteriores NO toca el rol (lo administra el admin
 * del tenant).
 *
 * Además calcula write_access (enabled/blocked) desde el estado de la licencia y lo
 * persiste en el perfil. Es la fuente de verdad del bloqueo de escritura por falta de
 * pago: las RLS de create/update/delete de cada entidad operativa exigen
 * user_condition write_access='enabled', así que un tenant vencido no puede escribir
 * ni siquiera llamando al SDK directamente. La lectura no se ve afectada (solo lectura).
 *
 * CORRECCIÓN 2026-09-03 — nunca decidir con `user.data` de auth.me(): el mismo bug
 * que rompía `switchTenant` (ver su propio comentario) vive aquí también, y esta
 * función corre en CADA carga de página — es la más peligrosa de las dos, porque
 * puede reafirmar en silencio un tenant viejo si `auth.me()` reporta un
 * `data.tenant_id` que no coincide con el documento real. Toda esta función usa
 * `selfData`, una relectura fresca vía `asServiceRole`, nunca `user.data`.
 */

function matchesTenant(t: any, userId: string, email: string): boolean {
  return (
    t.created_by_id === userId ||
    (t.owner_email || '').toLowerCase() === email ||
    (Array.isArray(t.members) && t.members.some((m: any) => (m.email || '').toLowerCase() === email))
  );
}

/**
 * Política de licencia (espejo de src/lib/license.js). Devuelve 'enabled' mientras la
 * licencia está active o en gracia past_due (1–7 días vencida); 'blocked' al pasar a
 * readonly (8–15) o disabled (16+), o si el owner la marca suspended/cancelled.
 */
function computeWriteAccess(tenant: any): 'enabled' | 'blocked' {
  if (!tenant) return 'enabled'; // sin tenant la RLS de tenant_id ya bloquea la escritura
  // 'expired' es un override manual del owner igual que cancelled/suspended: debe bloquear
  // aunque current_period_end aún no haya pasado (antes caía al cálculo por fechas y no revocaba nada).
  if (tenant.status === 'cancelled' || tenant.status === 'suspended' || tenant.status === 'expired') return 'blocked';
  const endStr = tenant.current_period_end || tenant.trial_ends_at;
  if (!endStr) return 'enabled'; // activa sin fecha de corte
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(endStr); end.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (daysLeft >= 0) return 'enabled';       // vigente
  const overdue = -daysLeft;
  if (overdue <= 7) return 'enabled';        // past_due: 7 días de gracia, app usable
  return 'blocked';                          // readonly (8–15) / disabled (16+)
}

// Roles que una entrada de `members[]` puede otorgar. `members[]` lo escribe
// cualquier owner/admin del tenant por la RLS de TenantLicense (y el filtro
// "sin owner" de InviteForm es solo de cliente), así que su `role` es un dato
// controlado por el cliente. Misma regla que manageRole: `owner` nunca sale de
// aquí — owner es solo el `owner_email` almacenado, y moverlo es trabajo de
// delegateOwnership. Un valor desconocido también se descarta.
const MEMBER_GRANTABLE_ROLES = new Set(['admin', 'dispatcher', 'mechanic', 'driver', 'investor', 'user']);
function grantableMemberRole(role: unknown): string | null {
  return typeof role === 'string' && MEMBER_GRANTABLE_ROLES.has(role) ? role : null;
}

// FUGA CORREGIDA (2026-10-01): antes esta función devolvía el registro COMPLETO del
// tenant a cualquier rol, incluido un conductor: `join_code` (la llave para pedir
// unirse), `members[]` (todos los correos y roles), notas, owner_email y facturación.
// Ahora solo owner/admin reciben el registro entero. El resto recibe lo que la UI
// necesita para funcionar: identidad/branding, estado y fechas de licencia (el banner
// de solo lectura), permisos por rol y ajustes de negocio. Plan y cupos solo para los
// roles que crean vehículos/conductores (dispatcher, mechanic).
const BASE_TENANT_FIELDS = [
  'id', 'tenant_name', 'slogan', 'logo_url',
  'color_primary', 'color_secondary', 'color_accent', 'color_background',
  'status', 'trial_ends_at', 'current_period_end',
  'permissions_config', 'settings',
];
const OPS_TENANT_FIELDS = ['plan', 'max_vehicles', 'max_drivers'];
function tenantForRole(tenant: any, role: string | null, isStoredOwner: boolean, isAppOwner: boolean): any {
  if (isStoredOwner || isAppOwner || role === 'owner' || role === 'admin') return tenant;
  const fields = ['dispatcher', 'mechanic'].includes(role || '')
    ? [...BASE_TENANT_FIELDS, ...OPS_TENANT_FIELDS]
    : BASE_TENANT_FIELDS;
  const out: Record<string, unknown> = {};
  for (const f of fields) if (tenant[f] !== undefined) out[f] = tenant[f];
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const email = (user.email || '').toLowerCase();

    // Relectura fresca y autoritativa del propio perfil — nunca `user.data` de
    // auth.me(). Ver la nota de arriba: `auth.me()` puede reconstruir `.data`
    // contaminado por restos de campos en la raíz del documento (de un bug de
    // escritura ya corregido) y reportar un `tenant_id` que no es el real.
    const selfRows = await svc.entities.User.filter({ id: user.id });
    const self = Array.isArray(selfRows) ? selfRows[0] : selfRows;
    const selfData = userData(self);
    const selfRole = self?.role ?? user.role;
    const currentTenantId = selfData?.tenant_id || null;

    // El owner de la app (gestor de licencias) se define por variable de entorno.
    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    const isAppOwner = !!appOwnerEmail && email === appOwnerEmail;

    const tenants = await svc.entities.TenantLicense.list('-created_date', 1000);

    // 1) tenant ya asignado y todavía válido
    let tenant = currentTenantId ? tenants.find((t) => t.id === currentTenantId) : null;
    const alreadyAssigned = !!tenant;

    // 2) primer tenant que empareja. `tenants` viene ordenado por -created_date, así
    // que el criterio es determinista aunque el email empareje con más de uno.
    if (!tenant) {
      tenant = tenants.find((t) => matchesTenant(t, user.id, email)) || null;
    }

    if (!tenant) {
      // Sin tenant la escritura ya está bloqueada por la RLS de tenant_id; reseteamos
      // write_access a 'enabled' para no dejar marcado a un usuario que dejó un tenant vencido.
      if (selfData?.write_access === 'blocked') {
        await svc.entities.User.update(user.id, { write_access: 'enabled' });
      }
      // Solicitud de unión por código (joinTenant) en espera o rechazada. Se lee
      // por el id de la SESIÓN y por service role: JoinRequest no es legible desde
      // el navegador. Esto es lo que hace que la pantalla "esperando aprobación"
      // sobreviva a una recarga. NO da ningún dato del tenant, solo su nombre.
      let joinRequest: Record<string, unknown> | null = null;
      try {
        const rows = await svc.entities.JoinRequest.filter({ user_id: user.id });
        const mine = Array.isArray(rows) ? rows[0] : null;
        if (mine && (mine.status === 'pending' || mine.status === 'rejected')) {
          const target = tenants.find((t) => t.id === mine.target_tenant_id) || null;
          joinRequest = {
            id: mine.id,
            status: mine.status,
            tenant_name: target?.tenant_name || 'la organización',
            requested_at: mine.requested_at || null,
          };
        }
      } catch (e) {
        console.error(`[resolveTenant] JoinRequest read failed for ${user.id}: ${(e as Error).message}`);
      }
      return Response.json({
        tenant_id: null,
        role: selfRole,
        is_app_owner: isAppOwner,
        needs_onboarding: ['owner', 'admin'].includes(selfRole),
        write_access: 'enabled',
        join_request: joinRequest,
      });
    }

    const member = Array.isArray(tenant.members)
      ? tenant.members.find((m) => (m.email || '').toLowerCase() === email)
      : null;

    // Vincular el perfil con su registro Driver (si existe) para que las RLS de
    // conductor (data.driver_id == {{user.data.driver_profile_id}}) funcionen.
    // Server-authoritative: driver_profile_id es write:false, solo lo setea esta función.
    let driverProfileId: string | null = null;
    try {
      const drivers = await svc.entities.Driver.filter({ profile_id: user.id });
      const drv = Array.isArray(drivers)
        ? (drivers.find((d) => d.tenant_id === tenant.id) || drivers[0] || null)
        : null;
      driverProfileId = drv?.id || null;
    } catch (_e) { /* el usuario no tiene un registro Driver vinculado */ }

    // Bloqueo de escritura por licencia. El owner de la app nunca se autobloquea
    // (gestiona las licencias), el resto depende del estado de su tenant. Si un admin lo
    // suspendió manualmente (suspended=true), permanece bloqueado sin importar la licencia.
    const writeAccess = isAppOwner
      ? 'enabled'
      : (selfData?.suspended ? 'blocked' : computeWriteAccess(tenant));

    // Persistir cambios en el perfil del usuario (service role, salta RLS de forma segura).
    // tenant_id/driver_profile_id/write_access van bajo `data` — es donde auth.me()/RLS
    // los leen ({{user.data.tenant_id}}, etc.); un objeto plano los escribiría en la raíz
    // del documento. `role` sí va plano: es un campo de plataforma (RLS lo referencia sin
    // el prefijo `data.`). El rol va en su PROPIA llamada, nunca junto a `data`: la
    // plataforma rechaza cambiar el rol del owner de la app aunque sea service role, y el
    // update es atómico — mezclados, se pierde también el tenant_id. Esta función corre en
    // cada carga de página, así que un fallo aquí deja al usuario sin binding de tenant sin
    // ningún error visible.
    // Se compara contra la RAÍZ (`self`), no contra `selfData`: para un perfil que
    // solo trae el `data` suelto, `selfData` ya muestra los valores correctos y el
    // patch saldría vacío, así que la copia plana que la RLS lee nunca se escribiría.
    const dataPatch: Record<string, unknown> = {};
    if (self?.tenant_id !== tenant.id) dataPatch.tenant_id = tenant.id;
    if (!(self && 'driver_profile_id' in self) || (self.driver_profile_id || null) !== driverProfileId) dataPatch.driver_profile_id = driverProfileId;
    // Sin `|| 'enabled'`: si el campo nunca se persistió (undefined), debe escribirse
    // explícitamente en cuanto writeAccess computa 'enabled' — de lo contrario el campo
    // se queda ausente para siempre.
    if (self?.write_access !== writeAccess) dataPatch.write_access = writeAccess;
    if (Object.keys(dataPatch).length) {
      await svc.entities.User.update(user.id, { ...dataPatch });
    }
    // El rol invitado solo se aplica en el primer enganche al tenant; después lo maneja el admin.
    let roleApplied = selfRole;
    // `owner_email` es rls.write:false: él decide quién es owner, no members[].
    const isStoredOwner = (tenant.owner_email || '').toLowerCase() === email;
    const invitedRole = isStoredOwner ? 'owner' : grantableMemberRole(member?.role);
    if (member?.role && !invitedRole && !isStoredOwner) {
      console.warn(`[resolveTenant] ignored members[].role "${member.role}" for ${user.id} in ${tenant.id}`);
    }
    // The tenant's stored owner is repaired even when the tenant is already
    // assigned: createTenant writes the role in its own call after tenant_id and
    // only logs a rejection, so a failed write would otherwise leave the creator
    // pointing at their tenant as a plain 'user' forever. The platform owner is
    // excluded (their role is 'admin', and the platform rejects changing it).
    const repairStoredOwner = isStoredOwner && !isAppOwner && selfRole !== 'owner';
    if ((!alreadyAssigned || repairStoredOwner) && invitedRole && invitedRole !== selfRole) {
      try {
        await svc.entities.User.update(user.id, { role: invitedRole });
        roleApplied = invitedRole;
      } catch (e) {
        console.error(`[resolveTenant] role update rejected for ${user.id}: ${(e as Error).message}`);
      }
    }

    return Response.json({
      tenant_id: tenant.id,
      role: roleApplied,
      is_app_owner: isAppOwner,
      needs_onboarding: false,
      write_access: writeAccess,
      // El registro COMPLETO, no un subconjunto de campos elegidos a mano.
      // CORRECCIÓN 2026-09-10: el cliente (TenantContext.jsx) usaba este
      // objeto solo para nada y volvía a buscar el tenant por su cuenta en
      // `base44.entities.TenantLicense.list()` — una llamada gateada por RLS
      // (`id === {{user.data.tenant_id}}`) que depende de que la plataforma ya
      // haya refrescado su propia vista de `user.data.tenant_id` para ESTE
      // usuario. Un usuario recién unido por código (`joinTenant`) quedó
      // exactamente en esa ventana: el documento en la base de datos ya tenía
      // el `tenant_id` correcto (confirmado leyéndolo directo), pero la
      // llamada RLS del cliente, inmediatamente después, no devolvía ese
      // tenant en la lista — así que `TenantContext` no encontraba nada,
      // `tenantId` se quedaba en null y la app lo regresaba al menú de
      // onboarding a pesar de que la unión ya había funcionado. Mismo
      // principio que el módulo 22 del estándar (nunca decidir con una lectura
      // cuya frescura depende de la sesión/JWT del llamador) aplicado un nivel
      // arriba: esta función ya resuelve el tenant correcto vía
      // `asServiceRole`, así que el cliente debe usar ESTE objeto directamente
      // en vez de volver a descubrirlo por su cuenta. Desde 2026-10-01 el objeto se recorta
      // por rol (ver tenantForRole): solo owner/admin ven join_code y members[].
      tenant: tenantForRole(tenant, roleApplied, isStoredOwner, isAppOwner),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
