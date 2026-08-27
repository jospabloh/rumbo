import { signAs } from './_acaciaSign.ts';

/**
 * _ticketHelpers.ts — shared support-ticket helpers: sequential folio
 * numbering, the real-time push of a new ticket to ACACIA Mission Control,
 * and the plain-text sanitizer used in every outbound email/ticket body.
 *
 * Extracted out of submitTicket/entry.ts (2026-08-27, Module 7+8 — cascade
 * delete + "the account-deletion request is a ticket too") because
 * `deleteTenant/entry.ts` needs the exact same three functions to log the
 * ticket it fires on every tenant deletion, and hand-copying a signing
 * routine is exactly the kind of drift `_acaciaSign.ts` (imported below)
 * already exists to prevent — see Module 15 in this repo's CLAUDE.md.
 *
 * CANONICAL SOURCE for this app: base44/functions/submitTicket/_ticketHelpers.ts.
 * A byte-identical copy lives at base44/functions/deleteTenant/_ticketHelpers.ts.
 * Change one, copy to the other.
 *
 * This is duplicated PER FUNCTION DIRECTORY rather than imported across
 * directories from a single shared base44/functions/_ticketHelpers.ts, even
 * though both functions' names start with an underscore-friendly pattern.
 * That was the first design tried here, and it was rejected on inspection,
 * not on a whim: this repo's own `_acaciaSign.ts` already carries the header
 * "Deno isolates each function directory ... an app with three
 * bridge-touching functions carries three identical copies — that is
 * expected" (acaciaControl, submitTicket, and now deleteTenant, which is
 * exactly three) — and there is no existing example anywhere in
 * `base44/functions/` of one function directory importing a file that lives
 * OUTSIDE its own directory. No authenticated Base44 CLI/deploy session was
 * available in this sandbox to actually deploy-test whether Base44's function
 * packaging would even resolve a `../_ticketHelpers.ts`-style import across
 * directories — rather than guess and risk a function that type-checks
 * locally but 500s in production on a missing module, this follows the one
 * cross-function-sharing pattern this repo already has evidence works.
 */

const TICKET_PREFIX = 'RUM';
const TICKET_PAD = 6;
// Fallback recipient when no support-email secret is configured, shared by
// submitTicket's own escalation email and deleteTenant's deletion notice.
export const DEFAULT_SUPPORT_EMAIL = 'soporte@acaciaco.com.mx';

// Siguiente folio secuencial global (RUM-000001). Deriva del MÁXIMO folio ya
// existente (no del conteo) para no repetir números si se borran tickets, y cae
// al conteo cuando ningún registro trae folio todavía (tickets previos al cambio).
export async function nextTicketNumber(svc: { entities: Record<string, { list: (o: string, n: number) => Promise<Array<Record<string, unknown>>> }> }): Promise<string> {
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

// Los correos se envían como texto plano; si el cliente de correo del destinatario
// igual renderiza HTML, esto evita que un asunto/descripción con markup (tags,
// atributos con javascript:, etc.) se interprete como HTML e imite el phishing.
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

// Real-time push of a new ticket to ACACIA Mission Control. This reflects the
// ticket in Mission Control within seconds — no manual sync — and lets Mission
// Control fire the unified ITIL alert (system ticket id + SLA anchored to the
// customer's creation instant) to the support desk. Returns true on a 2xx so the
// caller can skip its own legacy support email and avoid a double-send.
// Requires app secrets INGEST_HMAC_SECRET + ACACIA_MC_INGEST_URL (+ ACACIA_APP_SLUG=rumbo).
export async function pushToMissionControl(record: Record<string, unknown>): Promise<boolean> {
  const secret = Deno.env.get('INGEST_HMAC_SECRET');
  const url = Deno.env.get('ACACIA_MC_INGEST_URL');
  const app = Deno.env.get('ACACIA_APP_SLUG') || 'rumbo';
  if (!secret || !url) return false; // not configured → caller falls back to its own email
  try {
    const ts = Date.now().toString();
    const params = { app, record };
    // Signed with THIS app's derived key, not the bare INGEST_HMAC_SECRET.
    // That secret is one value shared by the whole portfolio, so a signature
    // made with it proves "someone holds the shared secret" and never "this is
    // <app>" — and since the app name travels in the body, any app could sign
    // a payload naming another. See _acaciaSign.ts, and Module 15 of
    // jospabloh/acacia-app-standard.
    const sig = await signAs(secret, app, ts, 'ticket.ingest', params);
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
