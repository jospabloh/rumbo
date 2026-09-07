import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { nextTicketNumber, pushToMissionControl, stripHtml, DEFAULT_SUPPORT_EMAIL } from './_ticketHelpers.ts';

/**
 * submitTicket — alta de un ticket de soporte desde cualquier usuario autenticado.
 *
 * Corre con service role para: (1) poder crear el ticket aunque la licencia esté
 * en solo-lectura (cuando más se necesita soporte), (2) sellar la identidad del
 * solicitante del lado servidor, (3) notificar por correo al equipo de soporte, y
 * (4) confirmarle al solicitante que su caso fue escalado (con el SLA de 48 h
 * hábiles y la sección del manual sugerida). Los correos son best-effort: si
 * fallan, el ticket igual se crea.
 *
 * `nextTicketNumber`/`pushToMissionControl`/`stripHtml` now live in
 * `_ticketHelpers.ts` (2026-08-27) — `deleteTenant/entry.ts` needs the exact
 * same three to log the ticket it fires on every tenant deletion (Module 8:
 * "the account-deletion request in Module 7's danger zone is a ticket too").
 * See that file's header for why it's a byte-identical per-directory copy
 * rather than a single cross-directory shared file.
 */
const CATEGORIES = ['bug', 'question', 'billing', 'feature', 'other'];
const PRIORITIES = ['low', 'normal', 'high'];
const SLA_HOURS = 48;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    // Relectura fresca del propio perfil — nunca `user.data` de auth.me(),
    // que puede reconstruirse contaminado por restos de campos en la raíz
    // del documento (mismo bug de switchTenant/resolveTenant, 2026-09-03).
    const selfRows = await svc.entities.User.filter({ id: user.id });
    const self = Array.isArray(selfRows) ? selfRows[0] : selfRows;
    const tenantId = self?.data?.tenant_id;
    if (!tenantId) return Response.json({ error: 'No tenant asociado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const subject = (body.subject || '').trim();
    const description = (body.body || '').trim();
    if (subject.length < 4) return Response.json({ error: 'El asunto es muy corto.' }, { status: 400 });
    if (description.length < 10) return Response.json({ error: 'Agrega más detalle (mínimo 10 caracteres).' }, { status: 400 });

    const category = CATEGORIES.includes(body.category) ? body.category : 'question';
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'normal';
    const suggestedSection = (body.suggested_section || '').toString().trim();
    // Brief estructurado del asistente BA/PO (opcional). Se guarda tal cual para
    // el render enriquecido en Mission Control; el cuerpo del ticket ya incluye
    // el mismo brief en Markdown, así que este campo es puramente aditivo.
    const aiBrief = (body.ai_brief && typeof body.ai_brief === 'object' && !Array.isArray(body.ai_brief))
      ? body.ai_brief
      : null;

    // Nombre de la organización (denormalizado para el panel del owner de la app).
    let tenantName = '';
    try {
      const tenants = await svc.entities.TenantLicense.list('-created_date', 1000);
      tenantName = tenants.find((t) => t.id === tenantId)?.tenant_name || '';
    } catch { /* no crítico */ }

    // Folio legible (ITSM): RUM-000001 secuencial y global. El hash interno de
    // Base44 sirve como llave técnica, pero el cliente y el SLA necesitan un
    // identificador humano. Se deriva del máximo folio existente (robusto ante
    // borrados) y cae al conteo si aún no hay ninguno. Volumen de soporte bajo →
    // secuencia por conteo es suficiente; se asigna del lado servidor.
    const ticketNumber = await nextTicketNumber(svc);

    const nowIso = new Date().toISOString();
    const ticket = await svc.entities.SupportTicket.create({
      ticket_number: ticketNumber,
      tenant_id: tenantId,
      tenant_name: tenantName,
      subject,
      body: description,
      category,
      priority,
      status: 'open',
      requester_id: user.id,
      requester_name: user.full_name || '',
      requester_email: user.email || '',
      responses: [],
      last_activity_at: nowIso,
      ...(aiBrief ? { ai_brief: aiBrief } : {}),
    });

    // 0) Push en tiempo real a ACACIA Mission Control. Si Mission Control acusa
    // recibo (2xx), ÉL manda la alerta unificada a soporte y NO duplicamos correo.
    const pushed = await pushToMissionControl(ticket as Record<string, unknown>);

    // 1) Escalar a soporte por correo — solo como respaldo si el push a Mission
    // Control no fue posible (no configurado / caído). Evita el doble envío.
    let emailed = false;
    // Acepta varios nombres de secret (Deno.env distingue mayúsculas): el creado en
    // Base44 es `Support_email`. Si no hay ninguno, cae al destino por defecto.
    const to = (
      Deno.env.get('Support_email') ||
      Deno.env.get('SUPPORT_EMAIL') ||
      Deno.env.get('APP_OWNER_EMAIL') ||
      DEFAULT_SUPPORT_EMAIL
    ).trim();
    if (!pushed && to) {
      try {
        await base44.integrations.Core.SendEmail({
          to,
          subject: `[Rumbo] Nuevo ticket (${priority}): ${stripHtml(subject)}`,
          body: [
            `Organización: ${stripHtml(tenantName || tenantId)}`,
            `Solicitante: ${stripHtml(user.full_name || '')} <${user.email || ''}>`,
            `Categoría: ${category} · Prioridad: ${priority}`,
            suggestedSection ? `Sección sugerida al usuario: ${stripHtml(suggestedSection)}` : '',
            '',
            stripHtml(description),
          ].filter(Boolean).join('\n'),
        });
        emailed = true;
      } catch { /* best-effort */ }
    }

    // 2) Confirmar al solicitante: caso escalado, SLA de 48 h hábiles y sección del manual.
    let notified = false;
    if (user.email) {
      try {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `Recibimos tu solicitud: ${stripHtml(subject)}`,
          body: [
            `Hola ${stripHtml(user.full_name || '')},`,
            '',
            'Recibimos tu solicitud y la escalamos a nuestro equipo de soporte.',
            `Te responderemos dentro de las próximas ${SLA_HOURS} horas hábiles.`,
            suggestedSection
              ? `\nMientras tanto, quizá te ayude revisar la sección "${stripHtml(suggestedSection)}" del Centro de ayuda en la app.`
              : '\nMientras tanto, puedes revisar el Centro de ayuda en la app.',
            '',
            'Tu solicitud:',
            stripHtml(description),
            '',
            '— Equipo de soporte de Rumbo',
          ].join('\n'),
        });
        notified = true;
      } catch { /* best-effort */ }
    }

    return Response.json({ ticket, pushed, emailed, notified, sla_hours: SLA_HOURS, suggested_section: suggestedSection });
  } catch (error) {
    // Pre-existing `error.message` without an `as Error` cast — `deno check`
    // flags this (found while touching this file for the module 7/8 fix;
    // this repo doesn't run `deno check` in CI, so it had never surfaced,
    // same as the resolveTenant/joinTenant/manageMember instances module 18
    // already documented). Fixed as a drive-by since this file was already
    // open.
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});