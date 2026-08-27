import { describe, it, expect } from 'vitest';
import { pickSessionsToDemote } from '../sessionDemotion.js';

describe('pickSessionsToDemote', () => {
  it('demotes every other non-revoked session', () => {
    const sessions = [
      { id: 'new', status: 'active' },
      { id: 'old-1', status: 'active' },
      { id: 'old-2', status: 'active' },
    ];
    expect(pickSessionsToDemote(sessions, 'new').sort()).toEqual(['old-1', 'old-2']);
  });

  it('never includes the new session itself', () => {
    const sessions = [{ id: 'new', status: 'active' }];
    expect(pickSessionsToDemote(sessions, 'new')).toEqual([]);
  });

  it('skips sessions that are already revoked', () => {
    const sessions = [
      { id: 'new', status: 'active' },
      { id: 'revoked-1', status: 'active', revoked_at: '2026-08-20T00:00:00.000Z' },
    ];
    expect(pickSessionsToDemote(sessions, 'new')).toEqual([]);
  });

  it('skips sessions already passive (nothing to write)', () => {
    const sessions = [
      { id: 'new', status: 'active' },
      { id: 'already-passive', status: 'passive' },
    ];
    expect(pickSessionsToDemote(sessions, 'new')).toEqual([]);
  });

  it('treats a missing status as active (pre-module-20 rows)', () => {
    const sessions = [
      { id: 'new', status: 'active' },
      { id: 'legacy-row' /* no status field at all */ },
    ];
    expect(pickSessionsToDemote(sessions, 'new')).toEqual(['legacy-row']);
  });

  it('returns [] for empty input or a missing new id', () => {
    expect(pickSessionsToDemote([], 'new')).toEqual([]);
    expect(pickSessionsToDemote([{ id: 'a' }], null)).toEqual([]);
    expect(pickSessionsToDemote(null, 'new')).toEqual([]);
  });
});
