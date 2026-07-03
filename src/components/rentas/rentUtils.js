import { format, startOfWeek, endOfWeek } from 'date-fns';

export const todayStr = () => format(new Date(), 'yyyy-MM-dd');

const dayNum = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

// Periodo actual: para semanal la semana arranca en el día de cobro de la unidad
// (rentDay); para diaria es el día de hoy.
export function currentPeriod(freq, rentDay) {
  const now = new Date();
  if (freq === 'daily') {
    const d = format(now, 'yyyy-MM-dd');
    return { period_start: d, period_end: d };
  }
  const weekStartsOn = dayNum[rentDay] ?? 1;
  return {
    period_start: format(startOfWeek(now, { weekStartsOn }), 'yyyy-MM-dd'),
    period_end: format(endOfWeek(now, { weekStartsOn }), 'yyyy-MM-dd'),
  };
}

export function statusOf(c) {
  const due = Number(c.amount_due) || 0;
  const paid = Number(c.amount_paid) || 0;
  // Un cargo sin saldo (due<=0, p. ej. cubierto por un bono de referido) está saldado.
  // Antes devolvía 'pending' y dejaba vivo el botón de cobro → riesgo de doble cobro.
  if (due <= 0) return 'paid';
  // Comparación en centavos para no dejar 'partial' un cargo pagado por redondeo de floats.
  if (Math.round((paid - due) * 100) >= 0) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}

export const isOverdue = (c) => statusOf(c) !== 'paid' && c.period_end && c.period_end < todayStr();

export const statusMeta = {
  paid: { label: 'Pagado', cls: 'bg-success/10 text-success' },
  partial: { label: 'Parcial', cls: 'bg-warning/10 text-warning' },
  pending: { label: 'Pendiente', cls: 'bg-muted text-muted-foreground' },
  overdue: { label: 'Vencido', cls: 'bg-destructive/10 text-destructive' },
};
