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

/**
 * El `file_url` viene del cliente y NO siempre es una subida nuestra: el campo "URL del
 * logo" de TenantEditor.jsx deja pegar cualquier dirección a mano (y hay tenants con una
 * de Unsplash), así que una allowlist de host rompería un flujo real. Lo que sí se puede
 * cerrar es el destino: esta URL la va a buscar el fetcher de la PLATAFORMA, corriendo con
 * rol de servicio, así que sin filtro este endpoint es un ariete contra la red interna —
 * `file://`, `http://localhost`, o el endpoint de metadatos de nube (169.254.169.254).
 *
 * Residual conocido, dicho y no tapado: esto no detiene un nombre público que resuelva a
 * una IP privada (DNS rebinding). Cerrar eso exige resolver el nombre antes de pasarlo, o
 * una allowlist — y la allowlist es justo lo que el campo de pegar impide.
 */
function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) return false;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false; // link-local + metadatos de nube
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  return true;
}

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
    if (!isPublicHttpUrl(file_url)) {
      return Response.json({ error: 'file_url debe ser una URL http(s) pública' }, { status: 400 });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: PROMPT,
      file_urls: [file_url],
      response_json_schema: COLOR_SCHEMA,
    });

    // Cast real de TS, no JSDoc: `/** @type */` sólo aplica en archivos .js, así que en
    // este .ts era decorativo y `deno check` marcaba los cuatro accesos de abajo contra
    // el `string | object` que declara InvokeLLM.
    const c = (result ?? {}) as { primary?: string; secondary?: string; accent?: string; background?: string };
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