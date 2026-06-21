import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * submitTicket — alta de un ticket de soporte desde cualquier usuario autenticado.
 *
 * Corre con service role para: (1) poder crear el ticket aunque la licencia esté
 * en solo-lectura (cuando más se necesita soporte), (2) sellar la identidad del
 * solicitante del lado servidor, (3) notificar por correo al equipo de soporte, y
 * (4) confirmarle al solicitante que su caso fue escalado (con el SLA de 48 h
 * hábiles y la sección del manual sugerida). Los correos son best-effort: si
 * fallan, el ticket igual se crea.
 */
const CATEGORIES = ['bug', 'question', 'billing', 'feature', 'other'];
const PRIORITIES = ['low', 'normal', 'high'];
// Destino por defecto del escalamiento. Se puede sobrescribir con el secret SUPPORT_EMAIL.
const DEFAULT_SUPPORT_EMAIL = 'soporte@acaciaco.com.mx';
const SLA_HOURS = 48;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = user.data?.tenant_id;
    if (!tenantId) return Response.json({ error: 'No tenant asociado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const subject = (body.subject || '').trim();
    const description = (body.body || '').trim();
    if (subject.length < 4) return Response.json({ error: 'El asunto es muy corto.' }, { status: 400 });
    if (description.length < 10) return Response.json({ error: 'Agrega más detalle (mínimo 10 caracteres).' }, { status: 400 });

    const category = CATEGORIES.includes(body.category) ? body.category : 'question';
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'normal';
    const suggestedSection = (body.suggested_section || '').toString().trim();

    const svc = base44.asServiceRole;

    // Nombre de la organización (denormalizado para el panel del owner de la app).
    let tenantName = '';
    try {
      const tenants = await svc.entities.TenantLicense.list('-created_date', 1000);
      tenantName = tenants.find((t) => t.id === tenantId)?.tenant_name || '';
    } catch { /* no crítico */ }

    const nowIso = new Date().toISOString();
    const ticket = await svc.entities.SupportTicket.create({
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
    });

    // 1) Escalar a soporte por correo (best-effort).
    let emailed = false;
    // Acepta varios nombres de secret (Deno.env distingue mayúsculas): el creado en
    // Base44 es `Support_email`. Si no hay ninguno, cae al destino por defecto.
    const to = (
      Deno.env.get('Support_email') ||
      Deno.env.get('SUPPORT_EMAIL') ||
      Deno.env.get('APP_OWNER_EMAIL') ||
      DEFAULT_SUPPORT_EMAIL
    ).trim();
    if (to) {
      try {
        await base44.integrations.Core.SendEmail({
          to,
          subject: `[Rumbo] Nuevo ticket (${priority}): ${subject}`,
          body: [
            `Organización: ${tenantName || tenantId}`,
            `Solicitante: ${user.full_name || ''} <${user.email || ''}>`,
            `Categoría: ${category} · Prioridad: ${priority}`,
            suggestedSection ? `Sección sugerida al usuario: ${suggestedSection}` : '',
            '',
            description,
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
          subject: `Recibimos tu solicitud: ${subject}`,
          body: [
            `Hola ${user.full_name || ''},`,
            '',
            'Recibimos tu solicitud y la escalamos a nuestro equipo de soporte.',
            `Te responderemos dentro de las próximas ${SLA_HOURS} horas hábiles.`,
            suggestedSection
              ? `\nMientras tanto, quizá te ayude revisar la sección "${suggestedSection}" del Centro de ayuda en la app.`
              : '\nMientras tanto, puedes revisar el Centro de ayuda en la app.',
            '',
            'Tu solicitud:',
            description,
            '',
            '— Equipo de soporte de Rumbo',
          ].join('\n'),
        });
        notified = true;
      } catch { /* best-effort */ }
    }

    return Response.json({ ticket, emailed, notified, sla_hours: SLA_HOURS, suggested_section: suggestedSection });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
