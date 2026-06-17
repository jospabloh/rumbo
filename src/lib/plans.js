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
