import {
  format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, differenceInCalendarDays,
} from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Rango de tiempo para /reports (Semana/Mes/Año/Personalizado) y su bucketing en
 * filas para la matriz día × unidad. Funciones puras (reciben `now` inyectable)
 * para poder probarlas sin montar la página — mismo criterio que src/lib/dashboard.js.
 */

const ymd = (d) => format(d, 'yyyy-MM-dd');

/** Parsea 'yyyy-MM-dd' como fecha LOCAL (evita el corrimiento de un día que da
 * `new Date('yyyy-MM-dd')` al interpretarlo como UTC en zonas horarias negativas). */
function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Resuelve un tipo de rango a fechas concretas `{ type, start, end }` (yyyy-MM-dd).
 * 'week' es una ventana móvil de 7 días terminando hoy (mismo criterio que
 * revenueSeries), no una semana calendario — evita depender de qué día se
 * considera inicio de semana.
 *
 * @param {string} type  'week'|'month'|'year'|'custom' (viene de un query param, por eso `string`).
 * @param {{ start?: string, end?: string }} [custom]
 * @param {Date} [now]
 */
export function resolveRange(type, custom = {}, now = new Date()) {
  if (type === 'month') return { type, start: ymd(startOfMonth(now)), end: ymd(endOfMonth(now)) };
  if (type === 'year') return { type, start: ymd(startOfYear(now)), end: ymd(endOfYear(now)) };
  if (type === 'custom' && custom.start && custom.end && custom.start <= custom.end) {
    return { type, start: custom.start, end: custom.end };
  }
  // 'week' (o 'custom' inválido/incompleto: cae a la ventana por default).
  return { type: 'week', start: ymd(subDays(now, 6)), end: ymd(now) };
}

/** Etiqueta legible del rango para el botón/encabezado de la página. */
export function rangeLabel(range, now = new Date()) {
  if (!range?.start || !range?.end) return '';
  const start = parseYmd(range.start);
  const end = parseYmd(range.end);
  if (range.type === 'year') return format(start, 'yyyy');
  if (range.type === 'month') return format(start, 'MMMM yyyy', { locale: es });
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  const startFmt = sameYear ? format(start, 'd MMM', { locale: es }) : format(start, 'd MMM yyyy', { locale: es });
  return `${startFmt} – ${format(end, 'd MMM yyyy', { locale: es })}`;
}

/**
 * Agrupa las fechas de `[start, end]` en filas para la matriz, con la
 * granularidad adecuada al tipo de rango: día de la semana (Semana),
 * semana del mes (Mes), o mes (Año). Personalizado usa la misma regla que
 * Semana si el rango es corto (≤ 14 días) o que Mes si es más largo.
 *
 * @param {{ type: string, start: string, end: string }} range
 * @returns {{ key: string, label: string, dates: string[] }[]}
 */
export function bucketRangeDates(range) {
  const { start, end } = range;
  const startD = parseYmd(start);
  const endD = parseYmd(end);
  const totalDays = differenceInCalendarDays(endD, startD) + 1;

  const effectiveType = range.type === 'custom' ? (totalDays <= 14 ? 'week' : totalDays <= 62 ? 'month' : 'year') : range.type;

  const dates = Array.from({ length: totalDays }, (_, i) => ymd(addDays(startD, i)));

  if (effectiveType === 'year') {
    const groups = new Map();
    for (const d of dates) {
      const key = d.slice(0, 7); // yyyy-MM
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }
    return [...groups.entries()].map(([key, ds]) => ({
      key, label: format(parseYmd(ds[0]), 'MMM', { locale: es }), dates: ds,
    }));
  }

  if (effectiveType === 'month') {
    const groups = new Map();
    dates.forEach((d, i) => {
      const key = `w${Math.floor(i / 7)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    });
    return [...groups.entries()].map(([key, ds], i) => ({
      key, label: `Sem ${i + 1} (${format(parseYmd(ds[0]), 'd')}–${format(parseYmd(ds.at(-1)), 'd')})`, dates: ds,
    }));
  }

  // 'week' (o custom corto): una fila por día, etiquetada con el día de la semana.
  return dates.map((d) => ({ key: d, label: format(parseYmd(d), 'EEE d', { locale: es }), dates: [d] }));
}

/**
 * Agrega el `daily` de una unidad (respuesta de fleetUnitMetrics) en las celdas
 * de `buckets` — una sola vez, reutilizado por la matriz y por el panel de
 * detalle de celda para que ambos sumen exactamente igual.
 *
 * @param {{ daily?: {date:string, revenue:number, cost:number, profit:number}[] }} vehicle
 * @param {{ key: string, dates: string[] }[]} buckets
 */
export function cellsForVehicle(vehicle, buckets) {
  const byDate = new Map((vehicle.daily || []).map((d) => [d.date, d]));
  return buckets.map((b) => {
    const rows = b.dates.map((d) => byDate.get(d)).filter(Boolean);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    return { bucket: b, revenue, cost, profit: revenue - cost };
  });
}
