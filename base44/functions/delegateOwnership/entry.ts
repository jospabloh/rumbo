import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * delegateOwnership — transfiere `TenantLicense.owner_email` a otro miembro ya existente
 * del mismo tenant.
 *
 * Antes esto era un `base44.entities.TenantLicense.update(tenant.id, { owner_email })`
 * directo desde `DangerZone.jsx`. La RLS de update de `TenantLicense` deja escribir a
 * cualquier `owner` **o `admin`** miembro del tenant, y `owner_email` no tenía candado de
 * campo — así que un admin podía delegarse la propiedad a sí mismo y, con eso, satisfacer
 * la condición de `TenantLicense.delete` (`data.owner_email == {{user.email}}`, la única
 * que exige). Ver módulo 14 (2026-08-23) en CLAUDE.md.
 *
 * Fix: `owner_email` pasa a `rls.write:false` (igual que los 10 campos de licencia del
 * módulo 1) y esta función, con service role, es el único camino tenant-scoped para
 * cambiarlo — `licensesAdmin`'s `patch` sigue siendo el otro, pero ese es
 * `APP_OWNER_EMAIL`-gated (el owner de la plataforma, no de este tenant).
 *
 * Seguridad:
 *   - Re-lee el `TenantLicense` guardado y compara su `owner_email` contra el caller —
 *     nunca confía en `user.role` del perfil (que ya vimos que un admin también puede
 *     alcanzar isAdminOrOwner) ni en nada del cuerpo de la petición.
 *   - El destino debe ser ya miembro del mismo tenant — mismo criterio que la UI aplicaba
 *     client-side, repetido aquí server-side.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetEmail = String(body?.targetEmail || '').trim().toLowerCase();
    if (!targetEmail) return Response.json({ error: 'targetEmail requerido' }, { status: 400 });

    const tenantId = user.data?.tenant_id;
    if (!tenantId) return Response.json({ error: 'Sin tenant asignado' }, { status: 400 });

    const svc = base44.asServiceRole;
    const tenant = await svc.entities.TenantLicense.get(tenantId).catch(() => null);
    if (!tenant) return Response.json({ error: 'Tenant no encontrado' }, { status: 404 });

    const callerEmail = (user.email || '').toLowerCase();
    const storedOwner = (tenant.owner_email || '').toLowerCase();
    if (!storedOwner || storedOwner !== callerEmail) {
      return Response.json({ error: 'Solo el owner actual puede delegar la propiedad del tenant' }, { status: 403 });
    }

    if (targetEmail === callerEmail) {
      return Response.json({ error: 'Ya eres el owner de este tenant' }, { status: 400 });
    }

    const members = Array.isArray(tenant.members) ? tenant.members : [];
    const targetIsMember = members.some((m: any) => (m?.email || '').toLowerCase() === targetEmail);
    if (!targetIsMember) {
      return Response.json({ error: 'El destino debe ser ya miembro de este tenant' }, { status: 400 });
    }

    const updated = await svc.entities.TenantLicense.update(tenantId, { owner_email: targetEmail });
    return Response.json({ success: true, tenant: updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
