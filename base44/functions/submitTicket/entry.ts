import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * submitTicket — alta de un ticket de soporte desde cualquier usuario autenticado.
 *
 * Corre con service role para: (1) poder crear el ticket aunque la licencia esté
 * en solo-lectura (cuando más se necesita soporte), (2) sellar la identidad del
 * solicitante del lado servidor, y (3) notificar por correo al equipo de soporte.
 * El correo es best-effort: si falla, el ticket igual se crea.
 */
const CATEGORIES = ['bug', 'question', 'billing', 'feature', 'other'];
const PRIORITIES = ['low', 'normal', 'high'];

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

    // Notificar a soporte (best-effort).
    let emailed = false;
    const to = (Deno.env.get('SUPPORT_EMAIL') || Deno.env.get('APP_OWNER_EMAIL') || '').trim();
    if (to) {
      try {
        await base44.integrations.Core.SendEmail({
          to,
          subject: `[Rumbo] Nuevo ticket: ${subject}`,
          body: [
            `Organización: ${tenantName || tenantId}`,
            `Solicitante: ${user.full_name || ''} <${user.email || ''}>`,
            `Categoría: ${category} · Prioridad: ${priority}`,
            '',
            description,
          ].join('\n'),
        });
        emailed = true;
      } catch { /* el correo es best-effort */ }
    }

    return Response.json({ ticket, emailed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
