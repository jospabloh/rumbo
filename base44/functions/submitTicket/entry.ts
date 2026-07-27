import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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
// Prefijo del folio ITSM. Se puede sobrescribir con el secret TICKET_PREFIX.
const TICKET_PREFIX = 'RUM';
const TICKET_PAD = 6;

// Siguiente folio secuencial global (RUM-000001). Deriva del MÁXIMO folio ya
// existente (no del conteo) para no repetir números si se borran tickets, y cae
// al conteo cuando ningún registro trae folio todavía (tickets previos al cambio).
async function nextTicketNumber(svc: { entities: Record<string, { list: (o: string, n: number) => Promise<Array<Record<string, unknown>>> }> }): Promise<string> {
  const prefix = (Deno.env.get('TICKET_PREFIX') || TICKET_PREFIX).trim();
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let maxSeq = 0;
  let total = 0;
  try {
    const rows = await svc.entities.SupportTicket.list('-created_date', 5000);
    total = rows.length;
    for (const r of rows) {
      const m = re.exec(String((r as { ticket_number?: unknown }).ticket_number ?? ''));
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    }
  } catch { /* si la lista falla, el fallback de tiempo evita colisión total */ }
  const seq = (maxSeq || total) + 1;
  return `${prefix}-${String(seq).padStart(TICKET_PAD, '0')}`;
}

// Stable JSON (keys sorted recursively) — mirrors Mission Control's
// api/_lib/ingestSign.js so both sides sign the exact same string.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

// Los correos se envían como texto plano; si el cliente de correo del destinatario
// igual renderiza HTML, esto evita que un asunto/descripción con markup (tags,
// atributos con javascript:, etc.) se interprete como HTML e imite el phishing.
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Real-time push of the new ticket to ACACIA Mission Control. This reflects the
// ticket in Mission Control within seconds — no manual sync — and lets Mission
// Control fire the unified ITIL alert (system ticket id + SLA anchored to the
// customer's creation instant) to the support desk. Returns true on a 2xx so the
// caller can skip Rumbo's own legacy support email and avoid a double-send.
// Requires app secrets INGEST_HMAC_SECRET + ACACIA_MC_INGEST_URL (+ ACACIA_APP_SLUG=rumbo).
async function pushToMissionControl(record: Record<string, unknown>): Promise<boolean> {
  const secret = Deno.env.get('INGEST_HMAC_SECRET');
  const url = Deno.env.get('ACACIA_MC_INGEST_URL');
  const app = Deno.env.get('ACACIA_APP_SLUG') || 'rumbo';
  if (!secret || !url) return false; // not configured → caller falls back to its own email
  try {
    const ts = Date.now().toString();
    const params = { app, record };
    const sig = await hmacHex(secret, `${ts}.ticket.ingest.${stableStringify(params)}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app, record, ts, sig }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

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
    // Brief estructurado del asistente BA/PO (opcional). Se guarda tal cual para
    // el render enriquecido en Mission Control; el cuerpo del ticket ya incluye
    // el mismo brief en Markdown, así que este campo es puramente aditivo.
    const aiBrief = (body.ai_brief && typeof body.ai_brief === 'object' && !Array.isArray(body.ai_brief))
      ? body.ai_brief
      : null;

    const svc = base44.asServiceRole;

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
    return Response.json({ error: error.message }, { status: 500 });
  }
});