import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
 */
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
      return Response.json({
        tenant_id: null,
        role: user.role,
        is_app_owner: isAppOwner,
        needs_onboarding: ['owner', 'admin'].includes(user.role),
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

    // Persistir cambios en el perfil del usuario (service role, salta RLS de forma segura)
    const patch: Record<string, unknown> = {};
    if (user.data?.tenant_id !== tenant.id) patch.tenant_id = tenant.id;
    if ((user.data?.driver_profile_id || null) !== driverProfileId) patch.driver_profile_id = driverProfileId;
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