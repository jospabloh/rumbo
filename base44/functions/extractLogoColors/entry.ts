// extractLogoColors — extrae una paleta de 4 colores de marca desde un logo
// subido, usando InvokeLLM con visión. Migrado del cliente para proteger los
// créditos de integración: un endpoint estrecho y específico, no un proxy LLM
// genérico.
//
// Entrada: { file_url }  — URL pública del logo (ya subido vía UploadPublicFile).
// Salida:  { primary, secondary, accent, background }  — 4 hex (#RRGGBB).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

const COLOR_SCHEMA = {
  type: 'object',
  properties: {
    primary: { type: 'string' },
    secondary: { type: 'string' },
    accent: { type: 'string' },
    background: { type: 'string' },
  },
};

const PROMPT = `Analiza este logo y extrae una paleta de 4 colores en hex que representen la marca:
1. primary: el color más dominante/destacado del logo
2. secondary: color de apoyo o secundario
3. accent: color de acento o contraste
4. background: color de fondo apropiado (oscuro si el logo es claro, viceversa)

Responde SOLO el JSON con los 4 colores en formato hex (#RRGGBB). No incluyas texto adicional.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const file_url = typeof body.file_url === 'string' ? body.file_url.trim() : '';
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: PROMPT,
      file_urls: [file_url],
      response_json_schema: COLOR_SCHEMA,
    });

    const c = /** @type {{ primary?: string; secondary?: string; accent?: string; background?: string }} */ (result);
    return Response.json({
      primary: c.primary || '',
      secondary: c.secondary || '',
      accent: c.accent || '',
      background: c.background || '',
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});