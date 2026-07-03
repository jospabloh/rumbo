import { describe, it, expect } from 'vitest';
import { statusOf, isOverdue } from '@/components/rentas/rentUtils';

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
