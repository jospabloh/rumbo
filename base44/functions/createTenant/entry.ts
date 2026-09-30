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
 * UN USUARIO, UN TENANT (2026-09-30, corrige una nota vieja de aquí que decía
 * lo contrario). El "módulo 18" que permitía varias organizaciones por email se
 * retiró el 2026-09-10 y no hay selector: crear una segunda dejaría la primera
 * inalcanzable. Por eso se responde 409 a quien ya pertenece a una organización
 * (perfil releído por service role, no `user.data`) y a quien tiene una solicitud
 * de unión pendiente por código (`JoinRequest`): esa persona espera la decisión de
 * un admin y no puede saltársela abriendo su propia organización. El owner de la
 * plataforma (APP_OWNER_EMAIL) es la excepción: gestiona licencias y puede tener
 * flotilla propia. Quien crea queda como owner de SU tenant, y solo de ese.
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

    // Relectura fresca del perfil — nunca `user.data` de auth.me() (2026-09-03).
    const selfRows = await svc.entities.User.filter({ id: user.id });
    const self = Array.isArray(selfRows) ? selfRows[0] : selfRows;
    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    const isAppOwner = !!appOwnerEmail && email === appOwnerEmail;
    if (!isAppOwner) {
      if (self?.data?.tenant_id) {
        return Response.json({
          error: 'Ya perteneces a una organización. Pide a un administrador que te dé de baja antes de crear otra.',
        }, { status: 409 });
      }
      const pending = await svc.entities.JoinRequest.filter({ user_id: user.id, status: 'pending' });
      if (Array.isArray(pending) && pending.length > 0) {
        return Response.json({
          error: 'Tienes una solicitud para unirte a una organización en espera. Cancélala si prefieres crear la tuya.',
        }, { status: 409 });
      }
    }

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
    // tenant_id/write_access van bajo `data` — es donde auth.me()/RLS los leen
    // ({{user.data.tenant_id}}); un objeto plano los escribiría en la raíz del
    // documento y `data.tenant_id` se quedaría sin fijar. `role` sí va plano: es un
    // campo de plataforma (RLS lo referencia sin el prefijo `data.`).
    // El rol va en su PROPIA llamada, nunca junto a `data`: la plataforma rechaza
    // cambiar el rol del owner de la app aunque sea service role ("You cannot update
    // the role of the owner of the app") y el update es atómico — mezclados, el
    // `tenant_id` del creador nunca se fijaría y el tenant recién creado quedaría
    // huérfano de su propio dueño.
    await svc.entities.User.update(user.id, {
      data: {
        tenant_id: tenant.id,
        write_access: 'enabled',
      },
    });
    try {
      if (user.role !== 'owner') await svc.entities.User.update(user.id, { role: 'owner' });
    } catch (e) {
      console.error(`[createTenant] role update rejected for ${user.id}: ${(e as Error).message}`);
    }

    return Response.json({ ok: true, tenant_id: tenant.id, tenant });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
