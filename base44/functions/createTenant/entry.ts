import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * createTenant — crea la organización (TenantLicense) de un usuario y lo convierte en su owner.
 *
 * Por qué función de servidor (service role):
 *   - La RLS de TenantLicense solo deja CREAR a usuarios con rol owner/admin. Un usuario
 *     nuevo que se registra con su correo entra con rol 'user' y NO podría crear su propia
 *     organización desde el cliente (problema huevo-gallina). Sin esto, "Crear mi
 *     organización" fallaba para todo usuario externo nuevo.
 *   - El cliente no puede auto-elevarse de rol (sería un agujero de seguridad). Aquí el
 *     service role hace la elevación de forma controlada: SOLO te vuelve owner del tenant
 *     que tú mismo acabas de crear.
 *
 * Seguridad:
 *   - Requiere sesión.
 *   - El join_code se genera en el servidor con entropía criptográfica.
 *   - Persiste rol=owner, tenant_id y write_access en el perfil (campos write:false en RLS).
 *
 * Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md, revisado 2026-08-26):
 * ya NO rechaza a un usuario que ya pertenece a otra organización — crear una
 * organización adicional es un caso legítimo (el mismo email administra dos
 * flotillas), igual que CtrlHQ's `complete-onboarding` (mode: "create") nunca
 * lo rechazó. El caller queda como owner de la organización recién creada y
 * su `tenant_id` activo se mueve a ella de inmediato; `resolveTenant` sigue
 * siendo quien descubre y deja volver a la anterior.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateJoinCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let body = '';
  for (let i = 0; i < 6; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  return `RUMBO-${body}`;
}

async function uniqueJoinCode(svc: any): Promise<string> {
  const existing = await svc.entities.TenantLicense.list('-created_date', 1000);
  const taken = new Set(existing.map((t: any) => (t.join_code || '').toUpperCase()));
  for (let i = 0; i < 10; i++) {
    const code = generateJoinCode();
    if (!taken.has(code.toUpperCase())) return code;
  }
  // Extremadamente improbable; añade entropía extra como último recurso.
  return `${generateJoinCode()}${ALPHABET[Math.floor(Math.random() * ALPHABET.length)]}`;
}

function clampStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const email = (user.email || '').toLowerCase();

    const body = await req.json().catch(() => ({}));
    const tenant_name = clampStr(body?.tenant_name, 80);
    if (!tenant_name) {
      return Response.json({ error: 'El nombre de la organización es requerido.' }, { status: 400 });
    }

    // Primer mes gratis: la prueba vence en hoy + 30 días — el estándar del portafolio
    // (jospabloh/acacia-app-standard, Módulo 1) fija 30 días exactos, no "un mes calendario".
    // setMonth(+1) drifta contra meses de 28-31 días (un tenant creado el 31 de enero
    // recibía ~28 días de prueba; uno creado hoy, 31) — auditoría 2026-08-26.
    const freeUntil = new Date(Date.now() + 30 * 86400000);
    const freeUntilStr = freeUntil.toISOString().slice(0, 10);

    const join_code = await uniqueJoinCode(svc);

    const tenant = await svc.entities.TenantLicense.create({
      tenant_name,
      slogan: clampStr(body?.slogan, 120),
      logo_url: clampStr(body?.logo_url, 500),
      color_primary: clampStr(body?.color_primary, 32),
      color_secondary: clampStr(body?.color_secondary, 32),
      color_accent: clampStr(body?.color_accent, 32),
      color_background: clampStr(body?.color_background, 32),
      plan: 'trial',
      status: 'active',
      owner_email: email,
      join_code,
      trial_ends_at: freeUntilStr,
      current_period_end: freeUntilStr,
      billing_cycle: 'monthly',
      members: [{ name: user.full_name || '', email, role: 'owner' }],
    });

    // Elevar al creador a owner de SU tenant y enlazar el perfil (server-authoritative).
    await svc.entities.User.update(user.id, {
      role: 'owner',
      tenant_id: tenant.id,
      write_access: 'enabled',
    });

    return Response.json({ ok: true, tenant_id: tenant.id, tenant });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
