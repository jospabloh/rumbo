import { describe, it, expect } from 'vitest';
import { revenueSeries } from '@/lib/dashboard';

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
