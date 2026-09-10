import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * ticketsAdmin — panel de soporte del owner de la app (APP_OWNER_EMAIL).
 *
 * Igual que licensesAdmin: única excepción cross-tenant, corre con service role
 * para ver y administrar los tickets de TODAS las organizaciones. Las RLS por
 * tenant siguen intactas para todos los demás.
 *
 * Acciones:
 *   - list:       todos los tickets (orden por última actividad).
 *   - set_status: cambia el estatus (open | in_progress | resolved | closed).
 *   - reply:      agrega una respuesta del soporte, pasa el ticket a "en proceso"
 *                 si estaba abierto, y notifica por correo al solicitante.
 */
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    if (!appOwnerEmail) return Response.json({ error: 'APP_OWNER_EMAIL no está configurado' }, { status: 403 });
    if ((user.email || '').toLowerCase() !== appOwnerEmail) {
      return Response.json({ error: 'Forbidden: app owner only' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'list') {
      const tickets = await svc.entities.SupportTicket.list('-last_activity_at', 1000);
      return Response.json({ tickets });
    }

    if (action === 'set_status') {
      const { ticketId, status } = body;
      if (!ticketId || !STATUSES.includes(status)) {
        return Response.json({ error: 'ticketId y status válido requeridos' }, { status: 400 });
      }
      const updated = await svc.entities.SupportTicket.update(ticketId, {
        status,
        last_activity_at: new Date().toISOString(),
      });
      return Response.json({ ticket: updated });
    }

    if (action === 'reply') {
      const { ticketId } = body;
      const text = (body.body || '').trim();
      if (!ticketId || text.length < 1) return Response.json({ error: 'ticketId y mensaje requeridos' }, { status: 400 });

      const all = await svc.entities.SupportTicket.list('-created_date', 1000);
      const ticket = all.find((t) => t.id === ticketId);
      if (!ticket) return Response.json({ error: 'Ticket no encontrado' }, { status: 404 });

      const nowIso = new Date().toISOString();
      const responses = Array.isArray(ticket.responses) ? ticket.responses : [];
      responses.push({ author_name: user.full_name || 'Soporte', author_role: 'support', body: text, created_at: nowIso });

      const nextStatus = ticket.status === 'open' ? 'in_progress' : ticket.status;
      const updated = await svc.entities.SupportTicket.update(ticketId, {
        responses,
        status: nextStatus,
        last_activity_at: nowIso,
      });

      // Notificar al solicitante (best-effort).
      let emailed = false;
      if (ticket.requester_email) {
        try {
          await svc.integrations.Core.SendEmail({
            to: ticket.requester_email,
            subject: `[Rumbo] Respuesta a tu ticket: ${ticket.subject}`,
            body: `${text}\n\n— Equipo de soporte de Rumbo`,
          });
          emailed = true;
        } catch { /* best-effort */ }
      }

      return Response.json({ ticket: updated, emailed });
    }

    return Response.json({ error: 'Acción desconocida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});