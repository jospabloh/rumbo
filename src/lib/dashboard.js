import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Serie de ingresos cobrados por día para los últimos `days` días (incluyendo hoy).
 *
 * Recorre los pagos registrados en cada RentCharge (`payments[].paid_at` en
 * formato `yyyy-MM-dd`) y los agrupa por fecha. Es una función pura para poder
 * probarla sin montar el chart.
 *
 * @param {Array<{ payments?: Array<{ paid_at?: string, amount?: number }> }>} charges
 * @param {{ days?: number, now?: Date }} [opts]
 * @returns {{ day: string, label: string, total: number }[]}
 */
export function revenueSeries(charges = [], { days = 7, now = new Date() } = {}) {
  // Acumular pagos por fecha una sola vez.
  const byDay = new Map();
  for (const charge of charges) {
    for (const p of charge?.payments || []) {
      if (!p?.paid_at) continue;
      byDay.set(p.paid_at, (byDay.get(p.paid_at) || 0) + (p.amount || 0));
    }
  }

  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(now, i);
    const day = format(date, 'yyyy-MM-dd');
    series.push({
      day,
      label: format(date, 'EEE', { locale: es }),
      total: byDay.get(day) || 0,
    });
  }
  return series;
}

// ---------------------------------------------------------------------------
// Métricas del centro de mando (tarjetas del Dashboard)
//
// Todas son funciones puras sobre los registros ya cargados del tenant, para
// poder probarlas sin montar la página. Aceptan `now` inyectable por la misma
// razón (los tests fijan la fecha).
// ---------------------------------------------------------------------------

/** 'yyyy-MM' de una fecha 'yyyy-MM-dd[...]' (o null si no es parseable). */
function yearMonthOf(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** ¿La fecha cae en el mismo mes calendario que `now`? Robusto a datetimes. */
function inCurrentMonth(dateStr, now) {
  const ym = yearMonthOf(dateStr);
  return !!ym && ym === format(now, 'yyyy-MM');
}

/** Días entre hoy (medianoche local) y una fecha 'yyyy-MM-dd'; null si inválida. */
function daysUntil(dateStr, now) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/**
 * Egresos del mes en curso, desglosados por fuente. Cada fuente declara su campo
 * de fecha y de monto: combustible (`logged_at`/`total_cost`), multas
 * (`issued_at`/`amount`), taller (`performed_at`/`cost`) y siniestros
 * (`incident_at`/`claim_amount`).
 *
 * @returns {{ total, fuel, fines, maintenance, claims }} montos del mes
 */
export function monthlyExpenses({ fuel = [], fines = [], maintenance = [], claims = [] } = {}, { now = new Date() } = {}) {
  const sum = (rows, dateField, amtField) =>
    rows.reduce((s, r) => (inCurrentMonth(r?.[dateField], now) ? s + (Number(r?.[amtField]) || 0) : s), 0);
  const fuelT = sum(fuel, 'logged_at', 'total_cost');
  const finesT = sum(fines, 'issued_at', 'amount');
  const maintT = sum(maintenance, 'performed_at', 'cost');
  const claimsT = sum(claims, 'incident_at', 'claim_amount');
  return { total: fuelT + finesT + maintT + claimsT, fuel: fuelT, fines: finesT, maintenance: maintT, claims: claimsT };
}

/** Ingresos cobrados en el mes en curso (pagos con `paid_at` dentro del mes). */
export function monthlyIncome(charges = [], { now = new Date() } = {}) {
  let total = 0;
  for (const c of charges) {
    for (const p of c?.payments || []) {
      if (inCurrentMonth(p?.paid_at, now)) total += Number(p?.amount) || 0;
    }
  }
  return total;
}

/** Multas sin pagar: cantidad y monto acumulado. */
export function pendingFines(fines = []) {
  const pend = fines.filter((f) => !f?.paid);
  return { count: pend.length, amount: pend.reduce((s, f) => s + (Number(f?.amount) || 0), 0) };
}

/**
 * Mantenimientos según su próxima fecha (`next_due_at`): cuántos ya vencieron y
 * cuántos vencen dentro de `withinDays` (14 por defecto, igual que las alertas).
 *
 * @returns {{ overdue: number, dueSoon: number }}
 */
export function maintenanceDue(maintenance = [], { now = new Date(), withinDays = 14 } = {}) {
  let overdue = 0;
  let dueSoon = 0;
  for (const m of maintenance) {
    const days = daysUntil(m?.next_due_at, now);
    if (days === null) continue;
    if (days < 0) overdue++;
    else if (days <= withinDays) dueSoon++;
  }
  return { overdue, dueSoon };
}
