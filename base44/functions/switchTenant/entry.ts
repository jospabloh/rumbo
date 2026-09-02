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

    // DIAGNÓSTICO TEMPORAL: capturar el arranque de la función en sí, por si
    // el problema estuviera en algo ANTES de llegar al write (p.ej. no
    // encontrar el tenant, o una excepción en TenantLicense.list).
    try {
      await svc.entities.DebugProbe.create({
        context: 'entry',
        user_id: user.id,
        user_email: email,
        details: JSON.stringify({ requestedId, rawUserData: user.data, rawUserRole: user.role, rawUserTenantId: (user as any).tenant_id }, null, 2).slice(0, 9000),
      });
    } catch (_e) { /* no bloquear el flujo real por el diagnóstico */ }

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
    // Solo se envían los campos que realmente cambiaron (mismo patrón que
    // resolveTenant): un `data` completo reemplazaría el subdocumento entero y
    // borraría cualquier otro campo que el usuario tuviera ahí (owner_group_id,
    // suspended, display_name).
    //
    // El app owner NUNCA recibe `role` en el patch: la plataforma bloquea el
    // cambio de rol del owner de la app incluso con service role ("You cannot
    // update the role of the owner of the app"), y como el update es atómico,
    // incluir `role` hace que TODO el update falle — incluyendo data.tenant_id,
    // que es justo lo que el switch debe mover. Era el bug que hacía que el
    // switch "no funcionara" para el usuario que pertenece a más tenants.
    // El rol se manda SIEMPRE en su propia llamada, nunca junto a `data`. El guard
    // `!isAppOwner` de arriba depende de que APP_OWNER_EMAIL esté configurada: si no
    // lo está, isAppOwner es false, el rol se cuela en el patch y volvemos al mismo
    // fallo atómico. Separadas, un rechazo de rol no puede arrastrarse el tenant.
    const dataPatch: Record<string, unknown> = {};
    if (user.data?.tenant_id !== candidate.id) dataPatch.tenant_id = candidate.id;
    if ((user.data?.driver_profile_id || null) !== driverProfileId) dataPatch.driver_profile_id = driverProfileId;
    if (user.data?.write_access !== writeAccess) dataPatch.write_access = writeAccess;

    // DIAGNÓSTICO TEMPORAL — borrar junto con la entidad DebugProbe cuando se
    // resuelva. El registro de User no se movía ni un campo y hacía falta ver
    // el resultado REAL de cada escritura (éxito o excepción completa) en vez
    // de seguir infiriéndolo desde afuera.
    async function probe(context: string, extra: Record<string, unknown>) {
      try {
        await svc.entities.DebugProbe.create({
          context,
          user_id: user.id,
          user_email: email,
          details: JSON.stringify(extra, null, 2).slice(0, 9000),
        });
      } catch (probeErr) {
        console.error(`[switchTenant] probe write failed: ${(probeErr as Error).message}`);
      }
    }

    await probe('before_data_write', {
      dataPatch,
      candidateId: candidate.id,
      currentDataTenantId: user.data?.tenant_id,
      userIdRaw: user.id,
    });

    // Primero el tenant: es el objetivo de la función y no debe depender del rol.
    if (Object.keys(dataPatch).length) {
      try {
        const updateResult = await svc.entities.User.update(user.id, { data: dataPatch });
        await probe('data_write_ok', { updateResult });
      } catch (e) {
        const err = e as Error;
        await probe('data_write_FAILED', {
          message: err?.message,
          name: err?.name,
          stack: err?.stack,
          stringified: String(e),
        });
      }
    } else {
      await probe('data_write_skipped_empty_patch', {});
    }

    // Después el rol, best-effort: si la plataforma lo rechaza (app owner), el
    // switch ya quedó hecho y se registra el motivo en vez de perderlo todo.
    let roleApplied = user.role;
    if (!isAppOwner && role !== user.role) {
      try {
        await svc.entities.User.update(user.id, { role });
        roleApplied = role;
        await probe('role_write_ok', { role });
      } catch (e) {
        const err = e as Error;
        console.error(`[switchTenant] role update rejected for ${user.id}: ${err.message}`);
        await probe('role_write_FAILED', { message: err?.message, name: err?.name, stringified: String(e) });
      }
    } else {
      await probe('role_write_skipped', { isAppOwner, role, userRole: user.role });
    }

    // Confirma qué quedó de verdad, re-leyendo el registro (no lo que la
    // llamada anterior devolvió, sino un fetch fresco).
    try {
      const fresh = await svc.entities.User.filter({ id: user.id });
      await probe('post_write_reread', { fresh: Array.isArray(fresh) ? fresh[0] : fresh });
    } catch (e) {
      await probe('post_write_reread_FAILED', { message: (e as Error)?.message });
    }

    return Response.json({
      ok: true,
      tenant_id: candidate.id,
      role: roleApplied,
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