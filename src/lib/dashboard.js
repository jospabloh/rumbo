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
