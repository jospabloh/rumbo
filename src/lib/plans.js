/**
 * Rumbo — Planes de licencia y sus límites.
 *
 * Niveles comerciales (además de la prueba gratis de 1 mes con la que nace el tenant):
 *  - trial       Prueba    5 vehículos / 5 conductores
 *  - starter     Starter   15 / 20
 *  - pro         Pro       50 / 75
 *  - enterprise  Flotilla  ilimitado
 *
 * El límite efectivo de un tenant es su `license.max_vehicles` / `license.max_drivers`
 * (lo edita el owner de la app en el SuperAdminPanel). Estos defaults dan el punto de
 * partida por plan y son el respaldo cuando la licencia no trae el campo.
 *
 * Convención: 0 / null / undefined / vacío = ilimitado (Infinity).
 *
 * Nota: el gate se aplica en el frontend (al crear vehículos/conductores). No es una
 * frontera de seguridad como el corte por licencia — exceder el cupo no expone datos de
 * nadie; es una regla de empaquetado/venta. Una aplicación dura a nivel de datos exigiría
 * enrutar la creación por una función de servidor que cuente los registros del tenant.
 */

export const PLANS = ['trial', 'starter', 'pro', 'enterprise'];

export const PLAN_LIMITS = {
  trial:      { max_vehicles: 5,  max_drivers: 5 },
  starter:    { max_vehicles: 15, max_drivers: 20 },
  pro:        { max_vehicles: 50, max_drivers: 75 },
  enterprise: { max_vehicles: 0,  max_drivers: 0 }, // 0 = ilimitado
};

export const PLAN_LABELS = {
  trial: 'Prueba',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Flotilla',
};

/** Normaliza un cupo: 0 / null / undefined / vacío / no-numérico → Infinity (ilimitado). */
function toCap(n) {
  if (n === null || n === undefined || n === '') return Infinity;
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return Infinity;
  return num;
}

/** Cupo efectivo de vehículos del tenant: el de su licencia si está definido, si no el del plan. */
export function vehicleLimit(license) {
  const explicit = license?.max_vehicles;
  if (explicit !== null && explicit !== undefined && explicit !== '') return toCap(explicit);
  return toCap((PLAN_LIMITS[license?.plan] || PLAN_LIMITS.trial).max_vehicles);
}

/** Cupo efectivo de conductores del tenant. */
export function driverLimit(license) {
  const explicit = license?.max_drivers;
  if (explicit !== null && explicit !== undefined && explicit !== '') return toCap(explicit);
  return toCap((PLAN_LIMITS[license?.plan] || PLAN_LIMITS.trial).max_drivers);
}

export const atVehicleLimit = (license, count) => count >= vehicleLimit(license);
export const atDriverLimit = (license, count) => count >= driverLimit(license);

/**
 * Cuántos registros consumen cupo: **sólo los que están en operación**.
 *
 * Una baja no ocupa lugar. Antes se contaban todas las filas y el efecto era el
 * contrario del que se vende: Car-Go Rent (plan Starter, 20 conductores) tenía 10
 * conductores activos y 16 dados de baja, así que la app le decía "26 de 20" y le
 * bloqueaba dar de alta al siguiente —dentro de su plan— con el mensaje "Mejora tu plan
 * para agregar más". Con rotación de personal, cualquier cliente acaba ahí: forzado a
 * subir de plan, o a borrar su propio historial para hacer sitio.
 *
 * `status` es `active | suspended | inactive` con default `active`, y un registro sin
 * `status` cuenta como activo — es lo que la entidad ya asume al crearlo.
 */
export const countsTowardQuota = (row) => (row?.status ?? 'active') === 'active';
export const quotaCount = (rows) => (rows || []).filter(countsTowardQuota).length;

/**
 * Qué tan lleno va el cupo, para pintar la barra de cupo (QuotaBar, mario_style):
 * 'ok' por debajo del 80 %, 'near' del 80 % al lleno, 'full' en el límite o
 * por encima (un límite de 0 ya está lleno). Un plan ilimitado nunca se llena.
 */
export function quotaTone(used, limit) {
  if (!Number.isFinite(limit)) return 'ok';
  if (limit <= 0) return 'full'; // un cupo de 0 es "no se permite ninguno", no "va bien"
  const ratio = used / limit;
  if (ratio >= 1) return 'full';
  if (ratio >= 0.8) return 'near';
  return 'ok';
}
