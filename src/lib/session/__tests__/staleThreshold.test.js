import { describe, it, expect } from 'vitest';
import { isSessionStale, STALE_AFTER_MS } from '../staleThreshold.js';

describe('isSessionStale', () => {
  const now = new Date('2026-08-26T12:00:00.000Z').getTime();

  it('is not stale just under the 48h threshold', () => {
    const lastActive = new Date(now - (STALE_AFTER_MS - 1000)).toISOString();
    expect(isSessionStale(lastActive, now)).toBe(false);
  });

  it('is stale just over the 48h threshold', () => {
    const lastActive = new Date(now - (STALE_AFTER_MS + 1000)).toISOString();
    expect(isSessionStale(lastActive, now)).toBe(true);
  });

  it('a legitimate multi-day-away laptop (under 48h) is not reaped', () => {
    const thirtySixHoursAgo = new Date(now - 36 * 60 * 60 * 1000).toISOString();
    expect(isSessionStale(thirtySixHoursAgo, now)).toBe(false);
  });

  it('a truly dead session (well over 48h) is reaped', () => {
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSessionStale(oneWeekAgo, now)).toBe(true);
  });

  it('returns false for missing or unparseable timestamps', () => {
    expect(isSessionStale(null, now)).toBe(false);
    expect(isSessionStale(undefined, now)).toBe(false);
    expect(isSessionStale('not-a-date', now)).toBe(false);
  });

  it('respects a custom threshold', () => {
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    expect(isSessionStale(oneHourAgo, now, 30 * 60 * 1000)).toBe(true);
    expect(isSessionStale(oneHourAgo, now, 2 * 60 * 60 * 1000)).toBe(false);
  });
});
