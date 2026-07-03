import { describe, it, expect } from 'vitest';
import { statusOf, isOverdue, periodsOverlap } from '@/components/rentas/rentUtils';

/** YYYY-MM-DD a `offsetDays` de hoy (negativo = pasado). */
function dateOffset(offsetDays) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

describe('statusOf', () => {
  it('marks a fully-paid charge as paid', () => {
    expect(statusOf({ amount_due: 1000, amount_paid: 1000 })).toBe('paid');
    expect(statusOf({ amount_due: 1000, amount_paid: 1200 })).toBe('paid');
  });

  it('treats a zero-due charge (covered by a bonus) as paid, not pending', () => {
    // Regresión: un cargo en $0 (bono de referido) devolvía 'pending' y dejaba vivo el
    // botón de cobro → riesgo de doble cobro.
    expect(statusOf({ amount_due: 0, amount_paid: 0 })).toBe('paid');
    expect(isOverdue({ amount_due: 0, amount_paid: 0, period_end: '2000-01-01' })).toBe(false);
  });

  it('marks partial and pending correctly', () => {
    expect(statusOf({ amount_due: 1000, amount_paid: 400 })).toBe('partial');
    expect(statusOf({ amount_due: 1000, amount_paid: 0 })).toBe('pending');
  });

  it('does not leave a cent-rounded full payment as partial', () => {
    // 0.1 + 0.2 = 0.30000000000000004; con due=0.3 debe contarse como pagado.
    expect(statusOf({ amount_due: 0.3, amount_paid: 0.1 + 0.2 })).toBe('paid');
  });
});

describe('isOverdue — con días de gracia', () => {
  it('sin gracia: vencido si period_end < hoy', () => {
    expect(isOverdue({ amount_due: 100, amount_paid: 0, period_end: dateOffset(-1) })).toBe(true);
    expect(isOverdue({ amount_due: 100, amount_paid: 0, period_end: dateOffset(1) })).toBe(false);
  });

  it('con gracia: el límite se extiende period_end + graceDays', () => {
    const c = { amount_due: 100, amount_paid: 0, period_end: dateOffset(-2) };
    expect(isOverdue(c, 3)).toBe(false); // límite = hace 2 días + 3 = mañana → aún no vence
    expect(isOverdue(c, 1)).toBe(true);  // límite = hace 2 días + 1 = ayer → vencido
  });

  it('un cargo pagado nunca está vencido', () => {
    expect(isOverdue({ amount_due: 100, amount_paid: 100, period_end: dateOffset(-30) }, 0)).toBe(false);
  });
});

describe('periodsOverlap', () => {
  it('detecta solapamiento y no-solapamiento de periodos', () => {
    expect(periodsOverlap('2026-06-29', '2026-07-05', '2026-07-01', '2026-07-07')).toBe(true);
    expect(periodsOverlap('2026-06-29', '2026-07-05', '2026-07-06', '2026-07-12')).toBe(false);
    // mismo inicio (dedup exacto previo) sigue contando como solapado
    expect(periodsOverlap('2026-07-01', '2026-07-07', '2026-07-01', '2026-07-07')).toBe(true);
  });
});
