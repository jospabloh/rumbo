import { describe, it, expect } from 'vitest';
import { revenueSeries, monthlyExpenses, monthlyIncome, pendingFines, maintenanceDue } from '@/lib/dashboard';

const NOW = new Date('2026-06-21T12:00:00');

describe('revenueSeries', () => {
  it('returns one point per day, ending today, in chronological order', () => {
    const s = revenueSeries([], { days: 7, now: NOW });
    expect(s).toHaveLength(7);
    expect(s[0].day).toBe('2026-06-15');
    expect(s[6].day).toBe('2026-06-21');
  });

  it('sums payments per day across charges', () => {
    const charges = [
      { payments: [{ paid_at: '2026-06-21', amount: 100 }, { paid_at: '2026-06-20', amount: 50 }] },
      { payments: [{ paid_at: '2026-06-21', amount: 25 }] },
    ];
    const s = revenueSeries(charges, { days: 7, now: NOW });
    const today = s.find((d) => d.day === '2026-06-21');
    const yesterday = s.find((d) => d.day === '2026-06-20');
    expect(today.total).toBe(125);
    expect(yesterday.total).toBe(50);
  });

  it('ignores payments outside the window and malformed entries', () => {
    const charges = [
      { payments: [{ paid_at: '2026-01-01', amount: 999 }] }, // out of window
      { payments: [{ amount: 10 }] },                          // no date
      { payments: [{ paid_at: '2026-06-21' }] },               // no amount
      {},                                                       // no payments
    ];
    const s = revenueSeries(charges, { days: 7, now: NOW });
    expect(s.reduce((a, d) => a + d.total, 0)).toBe(0);
  });

  it('defaults to a 7-day window', () => {
    expect(revenueSeries([], { now: NOW })).toHaveLength(7);
  });
});

describe('monthlyExpenses', () => {
  it('sums each source only within the current month', () => {
    const e = monthlyExpenses({
      fuel: [{ logged_at: '2026-06-05', total_cost: 1000 }, { logged_at: '2026-05-30', total_cost: 999 }],
      fines: [{ issued_at: '2026-06-10', amount: 500 }],
      maintenance: [{ performed_at: '2026-06-01', cost: 3500 }, { performed_at: '2026-06-15', cost: 1200 }],
      claims: [{ incident_at: '2026-06-20', claim_amount: 800 }],
    }, { now: NOW });
    expect(e.fuel).toBe(1000);        // el de mayo queda fuera
    expect(e.fines).toBe(500);
    expect(e.maintenance).toBe(4700);
    expect(e.claims).toBe(800);
    expect(e.total).toBe(7000);
  });

  it('ignores malformed dates/amounts and empty sources', () => {
    const e = monthlyExpenses({ fuel: [{ total_cost: 50 }, { logged_at: 'x', total_cost: 10 }] }, { now: NOW });
    expect(e.total).toBe(0);
  });
});

describe('monthlyIncome', () => {
  it('sums payments paid within the current month', () => {
    const charges = [
      { payments: [{ paid_at: '2026-06-02', amount: 300 }, { paid_at: '2026-05-31', amount: 100 }] },
      { payments: [{ paid_at: '2026-06-21', amount: 200 }] },
    ];
    expect(monthlyIncome(charges, { now: NOW })).toBe(500);
  });
});

describe('pendingFines', () => {
  it('counts and sums only unpaid fines', () => {
    const r = pendingFines([{ paid: true, amount: 2000 }, { paid: false, amount: 1500 }, { paid: false, amount: 500 }]);
    expect(r.count).toBe(2);
    expect(r.amount).toBe(2000);
  });
});

describe('maintenanceDue', () => {
  it('splits overdue vs. due within the window', () => {
    const rows = [
      { next_due_at: '2026-06-10' }, // vencido
      { next_due_at: '2026-06-25' }, // por vencer (4 días)
      { next_due_at: '2026-08-01' }, // fuera de ventana
      { next_due_at: null },         // sin fecha
    ];
    const r = maintenanceDue(rows, { now: NOW, withinDays: 14 });
    expect(r.overdue).toBe(1);
    expect(r.dueSoon).toBe(1);
  });
});
