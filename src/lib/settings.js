/**
 * Configuración de negocio por tenant.
 *
 * Todo valor de negocio que antes estaba "hardcodeado" (monto del bono de referido,
 * ventana de costo/km, etc.) vive aquí como un ajuste con un DEFAULT definido y queda
 * ABIERTO a personalización:
 *   - El admin/owner del tenant lo edita desde Administración → Configuración del negocio
 *     (se guarda en TenantLicense.settings; la RLS de update ya lo permite).
 *   - El platform owner puede editarlo para cualquier tenant vía la función licensesAdmin
 *     (service role), desde la pantalla de Licencias.
 *
 * Si un tenant no personaliza un ajuste, la app usa el default: nunca queda indefinido.
 */

/** @typedef {{ key: string, label: string, type: 'number'|'text', default: any, min?: number, help: string }} SettingDef */

/** Catálogo de ajustes configurables. Agregar uno nuevo = una entrada aquí (y usar getSetting). */
export const SETTINGS_SCHEMA = /** @type {SettingDef[]} */ ([
  {
    key: 'referral_bonus_amount',
    label: 'Bono por referido ($)',
    type: 'number', default: 1000, min: 0,
    help: 'Monto que gana el conductor que refiere, descontado de su renta.',
  },
  {
    key: 'referral_on_time_target',
    label: 'Pagos puntuales para liberar el bono',
    type: 'number', default: 4, min: 1,
    help: 'Cuántos pagos semanales puntuales debe cumplir el referido para liberar el bono.',
  },
  {
    key: 'cost_per_km_window_days',
    label: 'Ventana de costo por km (días)',
    type: 'number', default: 90, min: 1,
    help: 'Periodo hacia atrás para calcular el costo por kilómetro; gastos y kilómetros se toman del mismo periodo.',
  },
  {
    key: 'rent_grace_days',
    label: 'Días de gracia de renta',
    type: 'number', default: 0, min: 0,
    help: 'Días después del fin del periodo antes de marcar una renta como vencida.',
  },
  {
    key: 'maintenance_interval_km',
    label: 'Intervalo de mantenimiento preventivo (km)',
    type: 'number', default: 5000, min: 1,
    help: 'Cada cuántos kilómetros se estima el próximo mantenimiento preventivo cuando no hay una fecha capturada a mano.',
  },
  {
    key: 'tire_life_km',
    label: 'Vida útil estimada de llantas (km)',
    type: 'number', default: 40000, min: 1,
    help: 'Kilometraje promedio entre cambios de llantas, usado como estimado cuando una unidad no tiene suficiente historial propio.',
  },
]);

/** Mapa key → default, para lecturas rápidas y para el backend. */
export const SETTINGS_DEFAULTS = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));

/**
 * Lee un ajuste del tenant con su default. Nunca devuelve undefined para una key conocida.
 * @param {any} tenant  El registro TenantLicense (con .settings opcional).
 * @param {string} key
 */
export function getSetting(tenant, key) {
  const def = SETTINGS_SCHEMA.find((s) => s.key === key);
  const fallback = def ? def.default : undefined;
  const raw = tenant?.settings?.[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (def?.type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  return raw;
}

/**
 * Normaliza un objeto de settings capturado en un formulario para guardarlo:
 * descarta vacíos (→ usa default), castea números y respeta mínimos.
 * @param {Record<string, any>} input
 * @returns {Record<string, any>}
 */
export function normalizeSettings(input) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const def of SETTINGS_SCHEMA) {
    const raw = input?.[def.key];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue; // omitido = default
    if (def.type === 'number') {
      const n = Number(raw);
      if (Number.isFinite(n) && (def.min == null || n >= def.min)) out[def.key] = n;
    } else {
      out[def.key] = String(raw);
    }
  }
  return out;
}
