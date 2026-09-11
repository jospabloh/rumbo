// aiIntakeTurn — un turno de la entrevista del "BA/PO experto" que descubre
// los requisitos de un ticket de soporte antes de escalarlo. Migrado del
// cliente (src/lib/aiIntake.js) para proteger los créditos de integración:
// un endpoint estrecho que solo hace la entrevista, no un proxy LLM genérico.
//
// Entrada: { kind, subject, description, history }
//   kind:        'feature' | 'bug'
//   subject:     string — asunto del ticket
//   description: string — descripción inicial del solicitante
//   history:     Array<{ question: string, answer: string }> — entrevista hasta ahora
//
// Salida: { done, question?, brief? }  — mismo shape que TURN_SCHEMA.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// —— Contexto específico de la app (espejo de src/lib/aiIntake.js) ——————————————
const APP_CONTEXT = {
  name: 'Rumbo',
  domain:
    'SaaS multi-tenant para administrar flotillas de transporte: vehículos, ' +
    'conductores, rentas/cobros, gastos, mantenimiento de taller, alertas de ' +
    'vencimientos, ubicación de conductores y mensajería.',
  modules: [
    'Vehículos', 'Conductores', 'Rentas', 'Gastos', 'Taller (mantenimiento/inventario)',
    'Alertas', 'Ubicación', 'Mensajes', 'Importar', 'Admin y permisos', 'Mi licencia',
  ],
};

const MAX_QUESTIONS = 6;
const KIND_LABEL: Record<string, string> = { feature: 'nueva funcionalidad / mejora', bug: 'reporte de incidencia' };

const TURN_SCHEMA = {
  type: 'object',
  properties: {
    done: { type: 'boolean' },
    question: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        hint: { type: 'string' },
        suggestions: { type: 'array', items: { type: 'string' } },
      },
    },
    brief: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['feature', 'bug'] },
        title: { type: 'string' },
        summary: { type: 'string' },
        affected_area: { type: 'string' },
        user_story: { type: 'string' },
        acceptance_criteria: { type: 'array', items: { type: 'string' } },
        scope_in: { type: 'array', items: { type: 'string' } },
        scope_out: { type: 'array', items: { type: 'string' } },
        repro_steps: { type: 'array', items: { type: 'string' } },
        expected_behavior: { type: 'string' },
        actual_behavior: { type: 'string' },
        severity: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
        impact: { type: 'string' },
        priority_suggestion: { type: 'string', enum: ['low', 'normal', 'high'] },
        open_questions: { type: 'array', items: { type: 'string' } },
      },
      required: ['kind', 'title', 'summary'],
    },
  },
  required: ['done'],
};

function sanitize(text = '') {
  return String(text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{S}\n]/gu, '')
    .trim()
    .slice(0, 4000);
}

function systemPreamble(kind: string) {
  return `Eres un Analista de Negocio (BA) y Product Owner (PO) experto que atiende la mesa de soporte de "${APP_CONTEXT.name}".
Dominio de la app: ${APP_CONTEXT.domain}
Módulos/pantallas: ${APP_CONTEXT.modules.join(', ')}.

Estás atendiendo un caso de tipo: ${KIND_LABEL[kind] || kind}.

Tu objetivo: entrevistar al solicitante (que NO es técnico) con preguntas claras y
breves, UNA A LA VEZ, para reunir todo lo necesario y que un desarrollador pueda
pasar directo a DISEÑAR e IMPLEMENTAR sin volver a preguntar.

Reglas de la entrevista:
- Habla en español mexicano, cálido y concreto. Nada de tecnicismos.
- Una sola pregunta por turno. Que sea la de mayor valor según lo que ya sabes.
- No repitas lo que el usuario ya respondió. No hagas preguntas obvias ni de relleno.
- Ofrece 2-4 "suggestions" como respuestas rápidas cuando aplique (ej. pantallas, opciones).
- Para NUEVA FUNCIONALIDAD, cubre: quién lo necesita (rol), qué quiere lograr y para qué
  (beneficio/negocio), en qué pantalla/módulo, con qué datos/reglas, casos límite, y cómo
  sabrá que quedó bien (criterios de aceptación). Define alcance (incluye / NO incluye).
- Para INCIDENCIA, cubre: pasos exactos para reproducir, qué esperaba vs qué pasó, en qué
  pantalla/módulo, desde cuándo, a cuántos afecta, si hay mensaje de error o folio, y
  severidad/impacto en la operación.
- Cierra la entrevista (done=true) en cuanto tengas lo suficiente para un brief accionable,
  sin exceder ${MAX_QUESTIONS} preguntas. Antes de eso, done=false con la siguiente pregunta.
- Al cerrar, entrega el brief completo y bien redactado (title, summary, criterios, etc.).
  Redacta user_story como "Como <rol>, quiero <capacidad>, para <beneficio>".
  Deja en open_questions lo que quede pendiente de validar con el negocio.`;
}

function conversationBlock(subject: string, description: string, history: Array<{ question: string; answer: string }>) {
  const lines = [
    `Asunto: ${sanitize(subject)}`,
    `Descripción inicial del solicitante: ${sanitize(description)}`,
    '',
    'Entrevista hasta ahora:',
  ];
  if (!history.length) lines.push('(aún no has hecho preguntas)');
  for (const turn of history) {
    lines.push(`P (tú): ${sanitize(turn.question)}`);
    lines.push(`R (solicitante): ${sanitize(turn.answer)}`);
  }
  return lines.join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const kind = body.kind === 'feature' || body.kind === 'bug' ? body.kind : 'feature';
    const subject = typeof body.subject === 'string' ? body.subject : '';
    const description = typeof body.description === 'string' ? body.description : '';
    // El recorte a MAX_QUESTIONS no es cosmético. `forceClose` sólo decide qué SE LE PIDE
    // al modelo; `conversationBlock` renderizaba igual TODOS los turnos recibidos, y el
    // cuerpo lo controla quien llama. Sin este tope, una sola petición con 10 000 turnos
    // de 4 000 caracteres cada uno se convierte en un prompt de decenas de millones de
    // caracteres facturado a los créditos de integración — justo lo que esta función se
    // creó para proteger al migrarla del cliente. Una entrevista legítima nunca pasa de 6.
    const history = (Array.isArray(body.history) ? body.history.filter(
      (t: any) => t && typeof t.question === 'string' && typeof t.answer === 'string'
    ) : []).slice(0, MAX_QUESTIONS);

    const forceClose = history.length >= MAX_QUESTIONS;
    const prompt = `${systemPreamble(kind)}

${conversationBlock(subject, description, history)}

${forceClose
      ? 'Ya alcanzaste el máximo de preguntas: cierra ahora (done=true) y entrega el brief con lo que tengas.'
      : 'Decide: ¿te falta información clave? Si sí, done=false y formula la SIGUIENTE pregunta. Si ya es suficiente, done=true y entrega el brief.'}

Responde SOLO el JSON del esquema.`;

    const out = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
      response_json_schema: TURN_SCHEMA,
    });

    // Cast real de TS, no JSDoc (ver la nota en extractLogoColors/entry.ts).
    const result = ((out || { done: false }) as any);

    // Normalizar la forma, igual que en el cliente original.
    if (result.done && result.brief) {
      result.brief.kind = result.brief.kind || kind;
      return Response.json(result);
    }
    if (result.question && result.question.text) {
      return Response.json({ done: false, question: result.question });
    }
    // Respuesta degenerada → brief mínimo desde lo capturado.
    return Response.json({
      done: true,
      brief: {
        kind,
        title: sanitize(subject) || 'Solicitud de soporte',
        summary: sanitize(description),
        open_questions: ['La IA no pudo estructurar el caso; revisar con el solicitante.'],
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});