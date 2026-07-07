import { describe, it, expect } from 'vitest';
import { resolveRange, rangeLabel, bucketRangeDates } from '@/lib/fleetMetricsRange';

const NOW = new Date('2026-07-08T12:00:00'); // miércoles

describe('resolveRange', () => {
  it('week: rolling 7-day window ending today', () => {
    const r = resolveRange('week', {}, NOW);
    expect(r).toEqual({ type: 'week', start: '2026-07-02', end: '2026-07-08' });
  });

  it('month: current calendar month', () => {
    const r = resolveRange('month', {}, NOW);
    expect(r).toEqual({ type: 'month', start: '2026-07-01', end: '2026-07-31' });
  });

  it('year: current calendar year', () => {
    const r = resolveRange('year', {}, NOW);
    expect(r).toEqual({ type: 'year', start: '2026-01-01', end: '2026-12-31' });
  });

  it('custom: uses the given start/end when valid', () => {
    const r = resolveRange('custom', { start: '2026-05-01', end: '2026-05-15' }, NOW);
    expect(r).toEqual({ type: 'custom', start: '2026-05-01', end: '2026-05-15' });
  });

  it('custom: falls back to week when start > end or fields missing', () => {
    expect(resolveRange('custom', { start: '2026-05-15', end: '2026-05-01' }, NOW).type).toBe('week');
    expect(resolveRange('custom', {}, NOW).type).toBe('week');
  });
});

describe('rangeLabel', () => {
  it('formats each range type distinctly', () => {
    expect(rangeLabel(resolveRange('year', {}, NOW), NOW)).toBe('2026');
    expect(rangeLabel(resolveRange('month', {}, NOW), NOW)).toMatch(/julio/i);
    expect(rangeLabel(resolveRange('week', {}, NOW), NOW)).toContain('2026');
  });
});

describe('bucketRangeDates', () => {
  it('week: one row per day', () => {
    const buckets = bucketRangeDates(resolveRange('week', {}, NOW));
    expect(buckets).toHaveLength(7);
    expect(buckets.every((b) => b.dates.length === 1)).toBe(true);
    expect(buckets[0].dates[0]).toBe('2026-07-02');
    expect(buckets.at(-1).dates[0]).toBe('2026-07-08');
  });

  it('month: groups into ~7-day week rows covering every day exactly once', () => {
    const range = resolveRange('month', {}, NOW);
    const buckets = bucketRangeDates(range);
    const allDates = buckets.flatMap((b) => b.dates);
    expect(allDates).toHaveLength(31);
    expect(new Set(allDates).size).toBe(31);
  });

  it('year: groups into 12 month rows', () => {
    const range = resolveRange('year', {}, NOW);
    const buckets = bucketRangeDates(range);
    expect(buckets).toHaveLength(12);
    expect(buckets.flatMap((b) => b.dates)).toHaveLength(365);
  });

  it('custom: short span buckets like week, long span like month', () => {
    const short = bucketRangeDates({ type: 'custom', start: '2026-07-01', end: '2026-07-05' });
    expect(short).toHaveLength(5);
    const long = bucketRangeDates({ type: 'custom', start: '2026-01-01', end: '2026-02-28' });
    expect(long.length).toBeGreaterThan(1);
    expect(long.flatMap((b) => b.dates)).toHaveLength(59);
  });
});
