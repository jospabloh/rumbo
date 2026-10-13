import { addMonths, addWeeks, format, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export const KINDS = ['preventive', 'corrective', 'major_repair'];

export const KIND_LABELS = {
  preventive: 'Preventivo',
  corrective: 'Correctivo',
  major_repair: 'Arreglo mayor',
};

// Mismas etiquetas que el <Select> de MaintenanceForm.jsx.
export const CATEGORY_LABELS = {
  general: 'General',
  engine: 'Motor',
  brakes: 'Frenos',
  electrical: 'Eléctrico',
  tires: 'Llantas',
  body: 'Carrocería',
  other: 'Otro',
};

export const PERIODS = 12;

const parse = (s) => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

const bucketStart = (d, granularity) =>
  granularity === 'week' ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d);

const bucketKey = (d) => format(d, 'yyyy-MM-dd');

const bucketLabel = (d, granularity) =>
  granularity === 'week' ? format(d, 'd MMM', { locale: es }) : format(d, 'MMM yy', { locale: es });

/**
 * Servicios de mantenimiento por semana o por mes, apilados por tipo.
 *
 * Cuenta servicios, no solo pesos: la mayoría de los registros reales no traen
 * costo capturado, así que una serie de gasto saldría casi vacía. El costo va
 * aparte (`cost`, `withoutCost`) para el detalle de cada barra.
 *
 * Los últimos `PERIODS` periodos terminan en el más tardío entre hoy y el
 * último registro (hay mantenimientos capturados con fecha futura). Los
 * registros sin `performed_at` no tienen lugar en una línea de tiempo y se
 * omiten.
 *
 * @param {any[]} records
 * @param {'week'|'month'} granularity
 * @param {Date} [now]
 */
export function maintenanceTimeline(records, granularity, now = new Date()) {
  const dated = records.map((r) => ({ r, d: parse(r.performed_at) })).filter((x) => x.d);
  const latest = dated.reduce((m, x) => (x.d > m ? x.d : m), now);
  const step = granularity === 'week' ? addWeeks : addMonths;
  const last = bucketStart(latest, granularity);

  const buckets = [];
  const byKey = new Map();
  for (let i = PERIODS - 1; i >= 0; i--) {
    const start = step(last, -i);
    const b = { key: bucketKey(start), label: bucketLabel(start, granularity), total: 0, cost: 0, withoutCost: 0 };
    for (const k of KINDS) b[k] = 0;
    buckets.push(b);
    byKey.set(b.key, b);
  }

  for (const { r, d } of dated) {
    const b = byKey.get(bucketKey(bucketStart(d, granularity)));
    if (!b) continue;
    const kind = KINDS.includes(r.kind) ? r.kind : 'preventive';
    b[kind] += 1;
    b.total += 1;
    const cost = Number(r.cost);
    if (r.cost != null && r.cost !== '' && Number.isFinite(cost)) b.cost += cost;
    else b.withoutCost += 1;
  }
  return buckets;
}

/**
 * Servicios y gasto por categoría, de mayor a menor número de servicios.
 * Solo devuelve categorías con al menos un registro.
 *
 * @param {any[]} records
 */
export function maintenanceByCategory(records) {
  const map = new Map();
  for (const r of records) {
    const key = CATEGORY_LABELS[r.category] ? r.category : 'general';
    const row = map.get(key) || { key, label: CATEGORY_LABELS[key], count: 0, cost: 0 };
    row.count += 1;
    const cost = Number(r.cost);
    if (r.cost != null && r.cost !== '' && Number.isFinite(cost)) row.cost += cost;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.cost - a.cost);
}
