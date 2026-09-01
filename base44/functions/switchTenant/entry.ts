import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * switchTenant — mueve el tenant_id activo de un usuario que pertenece a más de un
 * TenantLicense (mismo email como creador, owner_email o miembro de varios a la vez).
 *
 * Ver "Módulo 18" en jospabloh/acacia-app-standard → STANDARD.md. `resolveTenant`
 * detecta la ambigüedad y devuelve `candidates`; esta función es el único camino
 * para MOVER el tenant_id persistido de un candidato a otro — nunca se hace desde
 * el cliente porque tenant_id es server-authoritative (rls.write:false en User,
 * igual que en resolveTenant).
 *
 * Seguridad — el punto entero de esta función:
 *   - El `tenant_id` que pide el cliente se valida recalculando el conjunto de
 *     candidatos legítimos del caller DESDE CERO en el servidor (mismo criterio que
 *     resolveTenant: creador, owner_email o miembro) — nunca se confía en que el id
 *     que mandó el cliente sea uno de los suyos.
 *   - Un tenant_id fuera de ese conjunto responde EXACTAMENTE igual que un tenant_id
 *     inexistente (404 genérico): el endpoint no debe funcionar como oráculo de
 *     existencia (Módulo 14 §6 del estándar — "un switch a un tenant al que no
 *     perteneces debe responder igual que uno que no existe").
 *   - El rol se re-deriva igual que en el primer enganche a ese tenant: owner_email
 *     → owner; miembro con rol propio → ese rol; creador sin ninguno de los dos →
 *     conserva el rol que ya tenía el perfil. No se toca `suspended`: es una acción
 *     de un admin sobre el tenant activo, no algo que un switch deba limpiar ni
 *     imponer — write_access sigue la misma fórmula que resolveTenant.
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requestedId = typeof body?.tenant_id === 'string' ? body.tenant_id : '';
    if (!requestedId) return Response.json({ error: 'Falta tenant_id.' }, { status: 400 });

    const svc = base44.asServiceRole;
    const email = (user.email || '').toLowerCase();

    const tenants = await svc.entities.TenantLicense.list('-created_date', 1000);
    const candidate = tenants.find((t) =>
      t.id === requestedId &&
      (
        t.created_by_id === user.id ||
        (t.owner_email || '').toLowerCase() === email ||
        (Array.isArray(t.members) && t.members.some((m: any) => (m.email || '').toLowerCase() === email))
      )
    ) || null;

    // Misma respuesta que un tenant inexistente: no confirma ni niega que
    // `requestedId` sea un tenant real al que el caller no pertenece.
    if (!candidate) {
      return Response.json({ error: 'No encontramos esa organización.' }, { status: 404 });
    }

    if (['cancelled', 'suspended', 'expired'].includes(candidate.status)) {
      return Response.json({ error: 'Esa organización no está disponible en este momento.' }, { status: 403 });
    }

    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    const isAppOwner = !!appOwnerEmail && email === appOwnerEmail;

    const member = Array.isArray(candidate.members)
      ? candidate.members.find((m: any) => (m.email || '').toLowerCase() === email)
      : null;
    const tenantOwnerEmail = (candidate.owner_email || '').toLowerCase();
    const role = tenantOwnerEmail === email ? 'owner' : (member?.role || user.role);

    // Vincula el perfil con su registro Driver EN ESTE tenant (mismo patrón que
    // resolveTenant) — un mismo email puede tener un Driver distinto por tenant.
    let driverProfileId: string | null = null;
    try {
      const drivers = await svc.entities.Driver.filter({ profile_id: user.id });
      const drv = Array.isArray(drivers) ? (drivers.find((d: any) => d.tenant_id === candidate.id) || null) : null;
      driverProfileId = drv?.id || null;
    } catch (_e) { /* sin registro Driver vinculado en este tenant */ }

    const writeAccess = isAppOwner
      ? 'enabled'
      : (user.data?.suspended ? 'blocked' : computeWriteAccess(candidate));

    // Los campos custom de User (tenant_id, driver_profile_id, write_access) viven
    // bajo `data` — así los lee auth.me()/RLS ({{user.data.tenant_id}}), y así quedó
    // guardado el tenant_id original de este usuario. Un objeto plano en este mismo
    // .update() los escribe en la raíz del documento en vez de en `data`, dejando
    // `data.tenant_id` sin tocar: el switch "funciona" (responde ok:true) pero la
    // próxima resolución de tenant sigue viendo el valor viejo. `role` sí va plano:
    // es un campo de plataforma, no de `data` (las RLS lo referencian sin el prefijo,
    // p. ej. user_condition:{role:"owner"}).
    await svc.entities.User.update(user.id, {
      role,
      data: {
        tenant_id: candidate.id,
        driver_profile_id: driverProfileId,
        write_access: writeAccess,
      },
    });

    return Response.json({
      ok: true,
      tenant_id: candidate.id,
      role,
      write_access: writeAccess,
      tenant: {
        id: candidate.id,
        tenant_name: candidate.tenant_name,
        slogan: candidate.slogan,
        logo_url: candidate.logo_url,
        color_primary: candidate.color_primary,
        color_secondary: candidate.color_secondary,
        color_accent: candidate.color_accent,
        color_background: candidate.color_background,
        plan: candidate.plan,
        status: candidate.status,
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
