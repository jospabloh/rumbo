import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * resolveTenant — asigna y devuelve el tenant del usuario autenticado de forma robusta.
 *
 * Es la fuente de verdad del binding usuario→tenant. Corre con service role, así que no
 * depende de las RLS del cliente (que serían un problema de huevo-y-gallina: para leer su
 * licencia el usuario ya necesitaría su tenant_id).
 *
 * Resolución (en orden):
 *   1. tenant_id ya guardado en el perfil (se valida que aún exista).
 *   2. creador del TenantLicense (owner que hizo onboarding).
 *   3. owner_email del TenantLicense.
 *   4. miembro en members[] (invitados). El rol del invitado se toma de members[].
 *
 * En el primer login del invitado persiste tenant_id (y su rol invitado) en el perfil.
 * En logins posteriores NO toca el rol (lo administra el admin del tenant).
 *
 * Además calcula write_access (enabled/blocked) desde el estado de la licencia y lo
 * persiste en el perfil. Es la fuente de verdad del bloqueo de escritura por falta de
 * pago: las RLS de create/update/delete de cada entidad operativa exigen
 * user_condition write_access='enabled', así que un tenant vencido no puede escribir
 * ni siquiera llamando al SDK directamente. La lectura no se ve afectada (solo lectura).
 */

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const email = (user.email || '').toLowerCase();
    const currentTenantId = user.data?.tenant_id || null;

    // El owner de la app (gestor de licencias) se define por variable de entorno.
    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    const isAppOwner = !!appOwnerEmail && email === appOwnerEmail;

    const tenants = await svc.entities.TenantLicense.list('-created_date', 1000);

    // 1) tenant ya asignado y todavía válido
    let tenant = currentTenantId ? tenants.find((t) => t.id === currentTenantId) : null;
    const alreadyAssigned = !!tenant;

    // 2-4) descubrir por creador, owner_email o miembro
    if (!tenant) {
      tenant =
        tenants.find((t) => t.created_by_id === user.id) ||
        tenants.find((t) => (t.owner_email || '').toLowerCase() === email) ||
        tenants.find(
          (t) =>
            Array.isArray(t.members) &&
            t.members.some((m) => (m.email || '').toLowerCase() === email)
        ) ||
        null;
    }

    if (!tenant) {
      // Sin tenant la escritura ya está bloqueada por la RLS de tenant_id; reseteamos
      // write_access a 'enabled' para no dejar marcado a un usuario que dejó un tenant vencido.
      if (user.data?.write_access === 'blocked') {
        await svc.entities.User.update(user.id, { write_access: 'enabled' });
      }
      return Response.json({
        tenant_id: null,
        role: user.role,
        is_app_owner: isAppOwner,
        needs_onboarding: ['owner', 'admin'].includes(user.role),
        write_access: 'enabled',
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
      : (user.data?.suspended ? 'blocked' : computeWriteAccess(tenant));

    // Persistir cambios en el perfil del usuario (service role, salta RLS de forma segura)
    const patch: Record<string, unknown> = {};
    if (user.data?.tenant_id !== tenant.id) patch.tenant_id = tenant.id;
    if ((user.data?.driver_profile_id || null) !== driverProfileId) patch.driver_profile_id = driverProfileId;
    // Sin `|| 'enabled'`: si el campo nunca se persistió (undefined), debe escribirse
    // explícitamente en cuanto writeAccess computa 'enabled' — de lo contrario el campo
    // se queda ausente para siempre (el fallback hacía que 'enabled' === 'enabled' y el
    // patch nunca se disparaba), y las RLS que exigen el string literal "enabled" en
    // `data.write_access` (RentCharge, Alert, …) rechazan cualquier escritura directa del
    // cliente aunque la licencia esté activa. Bug real: bloqueaba a todo usuario cuyo
    // write_access jamás se hubiera fijado antes (ej. un app owner probando por primera
    // vez "Generar cobros del periodo" — los datos de prueba se crean vía service role,
    // que no pasa por RLS, así que esto nunca se había ejercitado).
    if (user.data?.write_access !== writeAccess) patch.write_access = writeAccess;
    // El rol invitado solo se aplica en el primer enganche al tenant; después lo maneja el admin.
    if (!alreadyAssigned && member?.role && member.role !== user.role) patch.role = member.role;
    if (Object.keys(patch).length) {
      await svc.entities.User.update(user.id, patch);
    }

    return Response.json({
      tenant_id: tenant.id,
      role: patch.role || user.role,
      is_app_owner: isAppOwner,
      needs_onboarding: false,
      write_access: writeAccess,
      tenant: {
        id: tenant.id,
        tenant_name: tenant.tenant_name,
        slogan: tenant.slogan,
        logo_url: tenant.logo_url,
        color_primary: tenant.color_primary,
        color_secondary: tenant.color_secondary,
        color_accent: tenant.color_accent,
        color_background: tenant.color_background,
        plan: tenant.plan,
        status: tenant.status,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});