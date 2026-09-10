/**
 * aiIntake — el "BA + PO experto" que entrevista al solicitante ANTES de escalar
 * un ticket, para que el desarrollador reciba una especificación lista para
 * diseñar e implementar (no un "no funciona" sin contexto).
 *
 * Portable entre apps del portafolio ACACIA: lo único específico de la app es
 * el contexto (nombre + módulos, definido en el backend `aiIntakeTurn`). El
 * motor es el LLM de Base44, invocado desde el backend para proteger los
 * créditos de integración.
 *
 * Flujo (entrevista conversacional, una pregunta a la vez):
 *   startIntake() → primera pregunta
 *   answerIntake(history) → siguiente pregunta  … hasta que el modelo decide que
 *   tiene suficiente y devuelve `{ done: true, brief }` con el brief estructurado.
 *
 * El brief se convierte a Markdown con `briefToMarkdown()` y viaja DENTRO del
 * cuerpo del ticket (garantiza que llegue a Mission Control, al panel del owner y
 * al correo sin depender de un deploy de esquema), y además se manda como campo
 * estructurado `ai_brief` para render enriquecido en Mission Control.
 */
import { invokeFunction } from '@/lib/invokeFunction';

// Cuántas preguntas como máximo antes de forzar el brief (evita entrevistas
// eternas y acota el costo de LLM). El modelo puede cerrar antes.
// El backend (aiIntakeTurn) tiene su propia copia de este límite.
export const MAX_QUESTIONS = 6;

// Neutraliza intentos de inyección de prompt en el texto libre del usuario antes
// de incrustarlo (mismo criterio que el resto de la app).
function sanitize(text = '') {
  return String(text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{S}\n]/gu, '')
    .trim()
    .slice(0, 4000);
}

/**
 * @typedef {Object} IntakeQuestion
 * @property {string} text
 * @property {string} [hint]
 * @property {string[]} [suggestions]
 */
/**
 * @typedef {Object} IntakeBrief
 * @property {'feature'|'bug'} [kind]
 * @property {string} [title]
 * @property {string} [summary]
 * @property {string} [affected_area]
 * @property {string} [user_story]
 * @property {string[]} [acceptance_criteria]
 * @property {string[]} [scope_in]
 * @property {string[]} [scope_out]
 * @property {string[]} [repro_steps]
 * @property {string} [expected_behavior]
 * @property {string} [actual_behavior]
 * @property {string} [severity]
 * @property {string} [impact]
 * @property {string} [priority_suggestion]
 * @property {string[]} [open_questions]
 */
/**
 * @typedef {Object} IntakeTurnResult
 * @property {boolean} done
 * @property {IntakeQuestion} [question]
 * @property {IntakeBrief} [brief]
 */

/**
 * Ejecuta un turno de la entrevista. Devuelve el objeto validado por TURN_SCHEMA:
 *   { done:false, question:{text,hint,suggestions} }  ó  { done:true, brief:{…} }.
 *
 * @param {'feature'|'bug'} kind
 * @param {{subject?:string, description?:string, history?:Array<{question:string,answer:string}>}} [ctx]
 * @returns {Promise<IntakeTurnResult>}
 */
export async function intakeTurn(kind, { subject = '', description = '', history = [] } = {}) {
  // La llamada a InvokeLLM vive ahora en el backend (aiIntakeTurn) para proteger
  // los créditos de integración. El cliente solo envía los inputs de la entrevista.
  return /** @type {IntakeTurnResult} */ (await invokeFunction('aiIntakeTurn', {
    kind,
    subject,
    description,
    history,
  }));
}

const bullets = (arr) => (Array.isArray(arr) && arr.length ? arr.map((x) => `- ${x}`).join('\n') : null);

/**
 * Convierte el brief estructurado a Markdown legible para el desarrollador.
 * Este texto se incrusta en el cuerpo del ticket para que llegue a todos lados.
 */
export function briefToMarkdown(brief = {}) {
  const isBug = brief.kind === 'bug';
  const S = [];
  S.push(`## Brief ${isBug ? '· Incidencia' : '· Nueva funcionalidad'} (generado por IA BA/PO)`);
  if (brief.title) S.push(`**${brief.title}**`);
  if (brief.summary) S.push(brief.summary);
  if (brief.affected_area) S.push(`**Área / pantalla:** ${brief.affected_area}`);

  if (!isBug) {
    if (brief.user_story) S.push(`**Historia de usuario**\n${brief.user_story}`);
    const ac = bullets(brief.acceptance_criteria);
    if (ac) S.push(`**Criterios de aceptación**\n${ac}`);
    const si = bullets(brief.scope_in);
    if (si) S.push(`**Incluye (alcance)**\n${si}`);
    const so = bullets(brief.scope_out);
    if (so) S.push(`**NO incluye**\n${so}`);
  } else {
    const rs = bullets(brief.repro_steps);
    if (rs) S.push(`**Pasos para reproducir**\n${rs}`);
    if (brief.expected_behavior) S.push(`**Comportamiento esperado**\n${brief.expected_behavior}`);
    if (brief.actual_behavior) S.push(`**Comportamiento actual**\n${brief.actual_behavior}`);
    if (brief.severity) S.push(`**Severidad:** ${brief.severity}`);
  }

  if (brief.impact) S.push(`**Impacto:** ${brief.impact}`);
  if (brief.priority_suggestion) S.push(`**Prioridad sugerida:** ${brief.priority_suggestion}`);
  const oq = bullets(brief.open_questions);
  if (oq) S.push(`**Preguntas abiertas para el negocio**\n${oq}`);

  return S.join('\n\n');
}

/**
 * Cuerpo final del ticket = descripción original + el brief en Markdown.
 * Garantiza que el desarrollador vea la especificación completa aunque el campo
 * estructurado `ai_brief` no esté desplegado en el backend.
 */
export function composeTicketBody(originalDescription, brief) {
  const orig = sanitize(originalDescription);
  const md = briefToMarkdown(brief);
  return `${orig}\n\n---\n\n${md}`.trim();
}