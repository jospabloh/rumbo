import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * manageRole — el admin/owner de un tenant cambia el rol de otro miembro.
 *
 * Por qué función de servidor (service role):
 *   - Hasta 2026-08-26, `User.role` solo estaba protegido por `rls.write` a
 *     "el caller ya es owner/admin" — sin volver a comprobar nada del lado del
 *     servidor. `Admin.jsx`'s `handleRoleChange` escribía
 *     `base44.entities.User.update(userId, { role: newRole })` directo desde el
 *     cliente. Eso permitía dos cosas que ninguna regla frenaba:
 *       1. Auto-escalación: un admin podía ponerse `role: 'owner'` a sí mismo
 *          (el gate de UI en `UserRow.jsx`, `!isCurrentUser`, es solo de la
 *          interfaz — una llamada directa al SDK lo salta).
 *       2. Bloqueo total: nada impedía degradar secuencialmente a todos los
 *          demás owner/admin del tenant, dejándolo sin nadie que administre —
 *          sin vía de recuperación salvo un ticket de soporte.
 *     Encontrado por una auditoría independiente contra
 *     jospabloh/acacia-app-standard → STANDARD.md Módulo 2.
 *
 * Fix: `User.role` pasa a `rls.write:false` (mismo mecanismo que `tenant_id`,
 * `driver_profile_id`, `write_access`, `suspended` en este mismo archivo) y esta
 * función es el único camino para cambiarlo.
 *
 * Seguridad:
 *   - Rol y tenant del caller se derivan de su propia sesión: `caller.role`
 *     (campo de plataforma, confiable en `auth.me()`) y una relectura fresca
 *     por service role del propio perfil para `tenant_id` — nunca
 *     `caller.data` de `auth.me()`, que puede reconstruirse contaminado por
 *     restos de campos en la raíz del documento (2026-09-03). Nada de esto
 *     sale del cuerpo de la petición.
 *   - El objetivo debe pertenecer al MISMO tenant que el caller (mismo chequeo
 *     que `manageMember`).
 *   - No se puede aplicar a uno mismo (mismo guard que `manageMember` ya usa
 *     para evitar auto-bloqueo — aquí evita además la auto-escalación).
 *   - No se puede usar para asignar `'owner'` — transferir la propiedad ya
 *     tiene su propio camino, más estrecho (`delegateOwnership`, que relee el
 *     `owner_email` ALMACENADO y exige que el caller ya lo sea). Este función
 *     nunca debe ser una puerta trasera alrededor de esa.
 *   - Protege al owner del tenant (`TenantLicense.owner_email`) y al owner de
 *     la app (`APP_OWNER_EMAIL`) de ser degradados — mismo criterio que
 *     `manageMember`.
 *   - Guard de bloqueo-cero: si el objetivo actualmente es owner/admin y este
 *     cambio lo bajaría a un rol menor, cuenta cuántos OTROS miembros del
 *     tenant siguen siendo owner/admin; si quedaría en cero, rechaza. Sin este
 *     guard, un admin solitario que se degrada a sí mismo (antes de este fix,
 *     posible) o que degrada al último owner/admin restante deja el tenant sin
 *     nadie que administre.
 */

const VALID_ROLES = ['owner', 'admin', 'dispatcher', 'mechanic', 'driver', 'investor', 'user'];
const ADMIN_ROLES = new Set(['owner', 'admin']);

// Los campos custom de User (tenant_id) viven bajo `data`, y la plataforma no
// los filtra con `User.filter({tenant_id})` ni con `{'data.tenant_id'}`: devuelve
// siempre []. Se lista y se filtra en memoria (QA en vivo 2026-10-01).
async function usersOfTenant(svc: any, tenantId: string): Promise<any[]> {
  const rows = await svc.entities.User.list('-created_date', 5000);
  return (Array.isArray(rows) ? rows : []).filter((u: any) => (u?.data?.tenant_id || null) === tenantId);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!ADMIN_ROLES.has(caller.role)) {
      return Response.json({ error: 'Solo un administrador puede cambiar roles.' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    // Relectura fresca del propio perfil — nunca `caller.data` de auth.me(), que
    // puede reconstruir `.data` contaminado por restos de campos en la raíz del
    // documento (mismo bug encontrado y corregido en switchTenant/resolveTenant/
    // joinTenant/manageMember, 2026-09-03 — manageRole se había quedado fuera de
    // esa pasada aunque comparte exactamente el mismo patrón).
    const callerSelfRows = await svc.entities.User.filter({ id: caller.id });
    const callerSelf = Array.isArray(callerSelfRows) ? callerSelfRows[0] : callerSelfRows;
    const tenantId = callerSelf?.data?.tenant_id || null;
    if (!tenantId) return Response.json({ error: 'No perteneces a ninguna organización.' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { userId, newRole } = body;
    if (!userId || typeof newRole !== 'string' || !VALID_ROLES.includes(newRole)) {
      return Response.json({ error: 'Usuario o rol inválido.' }, { status: 400 });
    }

    if (userId === caller.id) {
      return Response.json({ error: 'No puedes cambiar tu propio rol.' }, { status: 400 });
    }

    // Asignar 'owner' es responsabilidad exclusiva de delegateOwnership (que
    // relee TenantLicense.owner_email almacenado y exige que el caller ya lo
    // sea) — este camino nunca debe poder crear un segundo "owner" de facto.
    if (newRole === 'owner') {
      return Response.json({
        error: 'Para transferir la propiedad usa "Delegar propiedad" en la Zona de Peligro, no el selector de rol.',
      }, { status: 400 });
    }

    const target = await svc.entities.User.get(userId).catch(() => null);
    if (!target) return Response.json({ error: 'Usuario no encontrado.' }, { status: 404 });

    if ((target.data?.tenant_id || null) !== tenantId) {
      return Response.json({ error: 'Ese usuario no pertenece a tu organización.' }, { status: 403 });
    }

    const tenant = await svc.entities.TenantLicense.get(tenantId).catch(() => null);
    const targetEmail = (target.email || '').toLowerCase();
    const tenantOwnerEmail = (tenant?.owner_email || '').toLowerCase();
    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    if (targetEmail && (targetEmail === tenantOwnerEmail || targetEmail === appOwnerEmail)) {
      return Response.json({ error: 'No puedes cambiar el rol del propietario de la organización.' }, { status: 403 });
    }

    const targetCurrentRole = target.role;
    const isDemotionFromAdmin = ADMIN_ROLES.has(targetCurrentRole) && !ADMIN_ROLES.has(newRole);
    if (isDemotionFromAdmin) {
      const members = await usersOfTenant(svc, tenantId);
      const remainingAdmins = members.filter(
        (m: any) => m.id !== userId && ADMIN_ROLES.has(m.role),
      ).length;
      if (remainingAdmins === 0) {
        return Response.json({
          error: 'No puedes quitar al último administrador de la organización — nadie más podría gestionarla.',
        }, { status: 409 });
      }
    }

    await svc.entities.User.update(userId, { role: newRole });
    return Response.json({ ok: true, role: newRole });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
