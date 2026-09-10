import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { nextTicketNumber, pushToMissionControl, stripHtml, DEFAULT_SUPPORT_EMAIL } from './_ticketHelpers.ts';

/**
 * deleteTenant — "Eliminar tenant" en la zona de peligro (módulo 7 del
 * estándar de portafolio). Antes esto era un
 * `base44.entities.TenantLicense.delete(tenant.id)` directo desde
 * `DangerZone.jsx`: borraba el renglón de licencia y dejaba huérfano, con
 * `tenant_id` apuntando a nada, cada Vehicle/Driver/Trip/… del tenant.
 *
 * Seguridad — mismo criterio que `delegateOwnership/entry.ts` (módulo 14,
 * 2026-08-24: "un admin puede hacerse owner y borrar el inquilino"):
 *   - El `tenant_id` se deriva del perfil del caller (`user.data.tenant_id`),
 *     nunca del cuerpo de la petición.
 *   - Solo el `owner_email` ALMACENADO en el `TenantLicense` puede borrarlo —
 *     no `user.role` del perfil (que un admin también alcanza), y no ningún
 *     valor que venga en el cuerpo. Un admin NO puede eliminar el tenant.
 *
 * Cascada — el universo de entidades tenant-scoped se tomó de
 * `grep -l tenant_id base44/entities/*.jsonc` (más completo que la lista de
 * 14 entidades, ya vieja, de `exportTenantData`: incluye Channel, Message,
 * LocationRequest, Catalog, UsefulLink, DriverPrivateNote, que se agregaron
 * después). De esa lista, tres casos se tratan aparte y NO entran al loop
 * genérico de borrado — ver los comentarios en cada uno:
 *   - `User` — se DESVINCULA, no se borra (mismo shape que la acción
 *     `remove` de `manageMember/entry.ts`: la cuenta sigue viva, sólo pierde
 *     la pertenencia a este tenant).
 *   - `SupportTicket` — se CONSERVA tal cual, ver el comentario junto a
 *     `CASCADE_ENTITIES` abajo.
 *   - `TenantLicense` — es el propio tenant; se borra al final, después de
 *     que toda la cascada operativa terminó.
 * `AppSession` no tiene campo `tenant_id` (confirmado por su propio
 * comentario en `AppSession.jsonc`), así que ni siquiera aparece en el grep
 * y queda fuera de alcance por completo.
 *
 * Cada entidad de la cascada se borra en su propio try/catch: una entidad
 * que falle no debe abortar el resto — se acumula un conteo por entidad y se
 * reporta en la respuesta.
 *
 * Ticket — Módulo 8: "the account-deletion request in Module 7's danger
 * zone is a ticket too, and it is the one nobody remembers to wire." Se
 * abre un `SupportTicket` documentando qué se borró, con la categoría
 * `other` (no existe `account_deletion` en el enum y no se justifica
 * inventar uno para esto), y se empuja a Mission Control igual que
 * `submitTicket`. Es best-effort de punta a punta: un fallo de ticket o de
 * push NUNCA debe bloquear ni reportar como fallida la eliminación del
 * tenant, que para entonces ya ocurrió.
 */

// Entidades operativas que sí se vacían — grep -l tenant_id base44/entities/*.jsonc,
// menos User/SupportTicket/TenantLicense/AppSession (ver comentario de arriba).
const CASCADE_ENTITIES = [
  'Alert', 'Catalog', 'Channel', 'DashboardUnitPref', 'Driver', 'DriverDocument',
  'DriverPrivateNote', 'Expense', 'Fine', 'FuelLog', 'InsuranceClaim',
  'LocationRequest', 'Maintenance', 'Message', 'Part', 'RentCharge', 'Trip',
  'UnitDayNote', 'UsefulLink', 'Vehicle', 'VehicleDocument',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    // Relectura fresca del propio perfil — nunca `user.data` de auth.me(), que
    // puede reconstruir `.data` contaminado por restos de campos en la raíz del
    // documento (mismo bug encontrado y corregido en switchTenant/resolveTenant/
    // joinTenant/manageMember, 2026-09-03).
    const selfRows = await svc.entities.User.filter({ id: user.id });
    const self = Array.isArray(selfRows) ? selfRows[0] : selfRows;
    const tenantId = self?.data?.tenant_id;
    if (!tenantId) return Response.json({ error: 'Sin tenant asignado' }, { status: 400 });

    const tenant = await svc.entities.TenantLicense.get(tenantId).catch(() => null);
    if (!tenant) return Response.json({ error: 'Tenant no encontrado' }, { status: 404 });

    const callerEmail = (user.email || '').toLowerCase();
    const storedOwner = (tenant.owner_email || '').toLowerCase();
    if (!storedOwner || storedOwner !== callerEmail) {
      return Response.json({ error: 'Solo el owner actual puede eliminar el tenant' }, { status: 403 });
    }

    const tenantName = tenant.tenant_name || '';

    // 1) Cascada de entidades operativas. Cada una en su propio try/catch —
    // ver el comentario de arriba: una entidad que falle no aborta el resto.
    const deleted: Record<string, number> = {};
    for (const entity of CASCADE_ENTITIES) {
      let count = 0;
      try {
        const rows = await svc.entities[entity].filter({ tenant_id: tenantId });
        for (const row of rows) {
          try {
            await svc.entities[entity].delete(row.id);
            count++;
          } catch (e) {
            console.error(`[deleteTenant] ${entity}.delete(${row.id}) failed: ${(e as Error).message}`);
          }
        }
      } catch (e) {
        console.error(`[deleteTenant] ${entity}.filter failed: ${(e as Error).message}`);
      }
      deleted[entity] = count;
    }

    // 2) Usuarios del tenant: se DESVINCULAN, nunca se borra la cuenta — el
    // humano detrás del User sigue existiendo y puede unirse/crear otro
    // tenant después (módulo 18). Mismo shape que la acción `remove` de
    // `manageMember/entry.ts`.
    let detachedUsers = 0;
    try {
      const users = await svc.entities.User.filter({ tenant_id: tenantId });
      for (const u of users) {
        try {
          // tenant_id/suspended/write_access/driver_profile_id van bajo `data` — es
          // donde auth.me()/RLS los leen; un objeto plano los escribe en la raíz del
          // documento (mismo bug encontrado y corregido en switchTenant/resolveTenant/
          // joinTenant/manageMember/createTenant). `role` sí va plano.
          // El rol va en su PROPIA llamada, nunca junto a `data`: la plataforma
          // rechaza cambiar el rol del owner de la app aunque sea service role, y el
          // update es atómico — mezclados, el owner de la app se quedaría atado a un
          // tenant que ya no existe.
          await svc.entities.User.update(u.id, {
            data: {
              tenant_id: null,
              suspended: false,
              write_access: 'enabled',
              driver_profile_id: null,
            },
          });
          try {
            await svc.entities.User.update(u.id, { role: 'user' });
          } catch (e) {
            console.error(`[deleteTenant] role update rejected for ${u.id}: ${(e as Error).message}`);
          }
          detachedUsers++;
        } catch (e) {
          console.error(`[deleteTenant] User.update(${u.id}) failed: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      console.error(`[deleteTenant] User.filter failed: ${(e as Error).message}`);
    }

    // 3) SupportTicket: se CONSERVA a propósito — es el historial de soporte/
    // auditoría que un operador de plataforma puede necesitar después de que
    // el tenant se fue (Módulo 7: "explicitly document what it does not
    // touch, e.g. billing history retained for compliance"). No se reasigna
    // ni se limpia su `tenant_id` — cada renglón ya trae `tenant_name`
    // denormalizado desde su creación (`submitTicket/entry.ts`), así que
    // sigue siendo legible por su propio rastro de auditoría aunque
    // `tenant_id` deje de resolver a un tenant vivo; no hay riesgo de que se
    // confunda con uno porque el `TenantLicense` con ese id ya no existe.
    let retainedTickets = 0;
    try {
      const tickets = await svc.entities.SupportTicket.filter({ tenant_id: tenantId });
      retainedTickets = tickets.length;
    } catch (e) {
      console.error(`[deleteTenant] SupportTicket.filter failed (informational only): ${(e as Error).message}`);
    }

    // 4) El propio TenantLicense, al final — después de que la cascada
    // operativa terminó. Si esto falla, los datos operativos ya se borraron
    // pero el registro de licencia sigue ahí: se reporta como error (con lo
    // ya cascadeado) en vez de fingir éxito.
    try {
      await svc.entities.TenantLicense.delete(tenantId);
    } catch (e) {
      console.error(`[deleteTenant] TenantLicense.delete(${tenantId}) failed: ${(e as Error).message}`);
      return Response.json({
        error: 'Se eliminaron los datos operativos pero no se pudo borrar el registro de licencia. Contacta a soporte.',
        deleted,
        detached_users: detachedUsers,
        retained_support_tickets: retainedTickets,
        tenant_id: tenantId,
        tenant_name: tenantName,
      }, { status: 500 });
    }

    // 5) Ticket de soporte documentando la eliminación (Módulo 8) — best-effort
    // de punta a punta, nunca bloquea ni revierte lo de arriba, que ya ocurrió.
    try {
      const bodyLines = [
        `Tenant eliminado: ${tenantName || tenantId} (${tenantId})`,
        `Eliminado por: ${user.full_name || ''} <${user.email || ''}>`,
        '',
        'Entidades operativas eliminadas:',
        ...Object.entries(deleted).map(([k, v]) => `  ${k}: ${v}`),
        '',
        `Usuarios desvinculados (tenant_id limpiado, cuenta conservada): ${detachedUsers}`,
        `Tickets de soporte conservados (historial, no se tocan): ${retainedTickets}`,
      ];
      const ticketBody = stripHtml(bodyLines.join('\n'));
      const ticketNumber = await nextTicketNumber(svc);
      const nowIso = new Date().toISOString();
      const ticket = await svc.entities.SupportTicket.create({
        ticket_number: ticketNumber,
        tenant_id: tenantId,
        tenant_name: tenantName,
        subject: `Tenant eliminado: ${stripHtml(tenantName || tenantId)}`,
        body: ticketBody,
        category: 'other',
        priority: 'normal',
        status: 'open',
        requester_id: user.id,
        requester_name: user.full_name || '',
        requester_email: user.email || '',
        responses: [],
        last_activity_at: nowIso,
      });

      const pushed = await pushToMissionControl(ticket as Record<string, unknown>);
      if (!pushed) {
        const to = (
          Deno.env.get('Support_email') ||
          Deno.env.get('SUPPORT_EMAIL') ||
          Deno.env.get('APP_OWNER_EMAIL') ||
          DEFAULT_SUPPORT_EMAIL
        ).trim();
        if (to) {
          await svc.integrations.Core.SendEmail({
            to,
            subject: `[Rumbo] Tenant eliminado: ${stripHtml(tenantName || tenantId)}`,
            body: ticketBody,
          }).catch(() => { /* best-effort */ });
        }
      }
    } catch (e) {
      console.error(`[deleteTenant] ticket logging failed (non-blocking): ${(e as Error).message}`);
    }

    return Response.json({
      ok: true, // for src/lib/invokeFunction.js's invokeOkFunction()
      success: true,
      deleted,
      detached_users: detachedUsers,
      retained_support_tickets: retainedTickets,
      tenant_id: tenantId,
      tenant_name: tenantName,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});