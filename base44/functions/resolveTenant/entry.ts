import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * resolveTenant — asigna y devuelve el tenant del usuario autenticado de forma robusta.
 *
 * Es la fuente de verdad del binding usuario→tenant. Corre con service role, así que no
 * depende de las RLS del cliente (que serían un problema de huevo-y-gallina: para leer su
 * licencia el usuario ya necesitaría su tenant_id).
 *
 * Resolución:
 *   1. Si ya hay tenant_id guardado en el perfil y sigue existiendo, se conserva —
 *      sin cambios respecto a antes.
 *   2. Si no, se calcula el conjunto COMPLETO de tenants candidatos (creador,
 *      owner_email o miembro en members[] — un mismo email puede aparecer en más de
 *      un TenantLicense a la vez). Con exactamente un candidato se autoasigna, igual
 *      que siempre. Con más de uno NO se adivina cuál: se devuelve
 *      `needs_tenant_choice` con la lista completa para que el cliente muestre un
 *      selector (ver "Módulo 18" en jospabloh/acacia-app-standard → STANDARD.md).
 *      Antes de este módulo se tomaba el primer match por orden de creación y se
 *      persistía para siempre — el segundo tenant no estaba mal resuelto, era
 *      invisible.
 *
 * En el primer enganche a un tenant persiste tenant_id (y el rol del invitado, si
 * aplica) en el perfil. En logins posteriores NO toca el rol (lo administra el admin
 * del tenant). Cambiar de un tenant candidato a otro después del primer enganche es
 * responsabilidad de `switchTenant`, no de esta función.
 *
 * La respuesta siempre incluye `candidates` (id, nombre, logo de cada tenant al que
 * el email pertenece) aunque ya haya uno asignado, para que el cliente pueda ofrecer
 * un selector persistente sin tener que volver a calcular la pertenencia por su cuenta.
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

function summarize(t: any) {
  return { id: t.id, tenant_name: t.tenant_name, logo_url: t.logo_url };
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
    const selfData = self?.data || {};
    const selfRole = self?.role ?? user.role;
    const currentTenantId = selfData?.tenant_id || null;

    // El owner de la app (gestor de licencias) se define por variable de entorno.
    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    const isAppOwner = !!appOwnerEmail && email === appOwnerEmail;

    const tenants = await svc.entities.TenantLicense.list('-created_date', 1000);

    // Conjunto completo de tenants a los que este email pertenece — no solo el
    // primero. Se calcula siempre, incluso con tenant_id ya asignado, para que la
    // respuesta de éxito también lleve `candidates` (switcher persistente).
    const candidates = tenants.filter((t) => matchesTenant(t, user.id, email));
    const candidateSummaries = candidates.map(summarize);

    // 1) tenant ya asignado y todavía válido
    let tenant = currentTenantId ? tenants.find((t) => t.id === currentTenantId) : null;
    const alreadyAssigned = !!tenant;

    if (!tenant) {
      if (candidates.length > 1) {
        // Ambiguo: más de un tenant candidato y nada persistido todavía. No se
        // adivina — se devuelve la lista completa para que el cliente muestre un
        // selector en vez de onboarding o una asignación silenciosa (Módulo 18).
        if (selfData?.write_access === 'blocked') {
          await svc.entities.User.update(user.id, { data: { ...selfData, write_access: 'enabled' } });
        }
        return Response.json({
          tenant_id: null,
          role: selfRole,
          is_app_owner: isAppOwner,
          needs_onboarding: false,
          needs_tenant_choice: true,
          candidates: candidateSummaries,
          write_access: 'enabled',
        });
      }
      // 0 o 1 candidato: comportamiento de siempre (autoasignar el único, o nada).
      tenant = candidates[0] || null;
    }

    if (!tenant) {
      // Sin tenant la escritura ya está bloqueada por la RLS de tenant_id; reseteamos
      // write_access a 'enabled' para no dejar marcado a un usuario que dejó un tenant vencido.
      if (selfData?.write_access === 'blocked') {
        await svc.entities.User.update(user.id, { data: { ...selfData, write_access: 'enabled' } });
      }
      return Response.json({
        tenant_id: null,
        role: selfRole,
        is_app_owner: isAppOwner,
        needs_onboarding: ['owner', 'admin'].includes(selfRole),
        needs_tenant_choice: false,
        candidates: candidateSummaries,
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
    const dataPatch: Record<string, unknown> = {};
    if (selfData?.tenant_id !== tenant.id) dataPatch.tenant_id = tenant.id;
    if ((selfData?.driver_profile_id || null) !== driverProfileId) dataPatch.driver_profile_id = driverProfileId;
    // Sin `|| 'enabled'`: si el campo nunca se persistió (undefined), debe escribirse
    // explícitamente en cuanto writeAccess computa 'enabled' — de lo contrario el campo
    // se queda ausente para siempre.
    if (selfData?.write_access !== writeAccess) dataPatch.write_access = writeAccess;
    if (Object.keys(dataPatch).length) {
      await svc.entities.User.update(user.id, { data: { ...selfData, ...dataPatch } });
    }
    // El rol invitado solo se aplica en el primer enganche al tenant; después lo maneja el admin.
    let roleApplied = selfRole;
    if (!alreadyAssigned && member?.role && member.role !== selfRole) {
      try {
        await svc.entities.User.update(user.id, { role: member.role });
        roleApplied = member.role;
      } catch (e) {
        console.error(`[resolveTenant] role update rejected for ${user.id}: ${(e as Error).message}`);
      }
    }

    return Response.json({
      tenant_id: tenant.id,
      role: roleApplied,
      is_app_owner: isAppOwner,
      needs_onboarding: false,
      needs_tenant_choice: false,
      candidates: candidateSummaries,
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
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
