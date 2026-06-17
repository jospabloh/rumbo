import { describe, it, expect } from 'vitest';
import { getLicenseInfo, isReadOnly, isDisabled, SUPPORT_URL } from '../license.js';

/** Build an ISO date string that is `offsetDays` away from today (negative = past). */
function dateOffset(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

describe('getLicenseInfo() — null / missing tenant', () => {
  it('returns active state when tenant is null (graceful no-op)', () => {
    const info = getLicenseInfo(null);
    expect(info.state).toBe('active');
    expect(info.daysLeft).toBeNull();
  });

  it('returns active state when tenant has no period end date', () => {
    const info = getLicenseInfo({ status: 'active' });
    expect(info.state).toBe('active');
  });
});

describe('getLicenseInfo() — forced disabled states', () => {
  it('cancelled status always returns disabled, regardless of period end', () => {
    const info = getLicenseInfo({
      status: 'cancelled',
      current_period_end: dateOffset(30), // still in the future — must be overridden
    });
    expect(info.state).toBe('disabled');
    expect(info.message).toMatch(/cancelada/i);
  });

  it('suspended status always returns disabled', () => {
    const info = getLicenseInfo({ status: 'suspended' });
    expect(info.state).toBe('disabled');
    expect(info.message).toMatch(/suspendida/i);
  });
});

describe('getLicenseInfo() — active (not yet expired)', () => {
  it('returns active with positive daysLeft when period ends in the future', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(10) });
    expect(info.state).toBe('active');
    expect(info.daysLeft).toBe(10);
    expect(info.overdue).toBe(0);
  });

  it('returns active with no "soon" message when more than 3 days remain', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(4) });
    expect(info.state).toBe('active');
    expect(info.message).toBe('');
  });

  it('returns a warning message when exactly 3 days remain', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(3) });
    expect(info.state).toBe('active');
    expect(info.message).not.toBe('');
    expect(info.message).toMatch(/3/);
  });

  it('returns active on the last day (daysLeft === 0)', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(0) });
    expect(info.state).toBe('active');
    expect(info.daysLeft).toBe(0);
  });

  it('falls back to trial_ends_at when current_period_end is absent', () => {
    const info = getLicenseInfo({ trial_ends_at: dateOffset(5) });
    expect(info.state).toBe('active');
    expect(info.daysLeft).toBe(5);
  });
});

describe('getLicenseInfo() — past_due (1–7 days overdue)', () => {
  it('returns past_due when 1 day overdue', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(-1) });
    expect(info.state).toBe('past_due');
    expect(info.overdue).toBe(1);
  });

  it('returns past_due when exactly 7 days overdue (boundary)', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(-7) });
    expect(info.state).toBe('past_due');
    expect(info.overdue).toBe(7);
    expect(info.message).toMatch(/1 día/); // 8 - 7 = 1 day left before readonly
  });

  it('past_due message contains renewal urgency text', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(-3) });
    expect(info.message).toMatch(/renovar/i);
  });
});

describe('getLicenseInfo() — readonly (8–15 days overdue)', () => {
  it('returns readonly when 8 days overdue (boundary)', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(-8) });
    expect(info.state).toBe('readonly');
    expect(info.overdue).toBe(8);
  });

  it('returns readonly when 15 days overdue (boundary)', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(-15) });
    expect(info.state).toBe('readonly');
    expect(info.overdue).toBe(15);
  });

  it('readonly message mentions solo lectura', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(-10) });
    expect(info.message).toMatch(/solo lectura/i);
  });
});

describe('getLicenseInfo() — disabled (16+ days overdue)', () => {
  it('returns disabled when 16 days overdue (boundary)', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(-16) });
    expect(info.state).toBe('disabled');
    expect(info.overdue).toBe(16);
  });

  it('returns disabled when far in the past (e.g. 60 days overdue)', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(-60) });
    expect(info.state).toBe('disabled');
  });
});

describe('isReadOnly() and isDisabled() helpers', () => {
  it('isReadOnly returns true only for readonly state', () => {
    expect(isReadOnly({ state: 'readonly' })).toBe(true);
    expect(isReadOnly({ state: 'active' })).toBe(false);
    expect(isReadOnly({ state: 'disabled' })).toBe(false);
    expect(isReadOnly({ state: 'past_due' })).toBe(false);
  });

  it('isDisabled returns true only for disabled state', () => {
    expect(isDisabled({ state: 'disabled' })).toBe(true);
    expect(isDisabled({ state: 'active' })).toBe(false);
    expect(isDisabled({ state: 'readonly' })).toBe(false);
  });

  it('isReadOnly and isDisabled return false for null/undefined', () => {
    expect(isReadOnly(null)).toBe(false);
    expect(isReadOnly(undefined)).toBe(false);
    expect(isDisabled(null)).toBe(false);
    expect(isDisabled(undefined)).toBe(false);
  });

  it('an expired/cancelled tenant produces an info that isDisabled recognises', () => {
    const info = getLicenseInfo({ status: 'cancelled' });
    expect(isDisabled(info)).toBe(true);
    expect(isReadOnly(info)).toBe(false);
  });

  it('an 8-day-overdue tenant produces an info that isReadOnly recognises', () => {
    const info = getLicenseInfo({ current_period_end: dateOffset(-8) });
    expect(isReadOnly(info)).toBe(true);
    expect(isDisabled(info)).toBe(false);
  });
});

describe('SUPPORT_URL', () => {
  it('is a non-empty string', () => {
    expect(typeof SUPPORT_URL).toBe('string');
    expect(SUPPORT_URL.length).toBeGreaterThan(0);
  });
});
