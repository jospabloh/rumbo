import { describe, it, expect } from 'vitest';
import { getSetting, normalizeSettings, SETTINGS_DEFAULTS, SETTINGS_SCHEMA } from '@/lib/settings';

describe('getSetting', () => {
  it('returns the default when the tenant is null or has no settings', () => {
    expect(getSetting(null, 'referral_bonus_amount')).toBe(1000);
    expect(getSetting({}, 'referral_bonus_amount')).toBe(1000);
    expect(getSetting({ settings: {} }, 'cost_per_km_window_days')).toBe(90);
  });

  it('returns the default when a value is empty string / null', () => {
    expect(getSetting({ settings: { referral_bonus_amount: '' } }, 'referral_bonus_amount')).toBe(1000);
    expect(getSetting({ settings: { referral_bonus_amount: null } }, 'referral_bonus_amount')).toBe(1000);
  });

  it('returns the tenant-customized value when present', () => {
    expect(getSetting({ settings: { referral_bonus_amount: 1500 } }, 'referral_bonus_amount')).toBe(1500);
    expect(getSetting({ settings: { referral_bonus_amount: '1500' } }, 'referral_bonus_amount')).toBe(1500);
  });

  it('falls back to default on a non-numeric value for a number setting', () => {
    expect(getSetting({ settings: { cost_per_km_window_days: 'abc' } }, 'cost_per_km_window_days')).toBe(90);
  });

  it('every schema entry has a default reflected in SETTINGS_DEFAULTS', () => {
    for (const def of SETTINGS_SCHEMA) {
      expect(SETTINGS_DEFAULTS[def.key]).toBe(def.default);
      expect(getSetting(null, def.key)).toBe(def.default);
    }
  });
});

describe('normalizeSettings', () => {
  it('drops empty values (so the app uses defaults) and casts numbers', () => {
    const out = normalizeSettings({ referral_bonus_amount: '1200', referral_on_time_target: '', cost_per_km_window_days: '30' });
    expect(out).toEqual({ referral_bonus_amount: 1200, cost_per_km_window_days: 30 });
    expect('referral_on_time_target' in out).toBe(false);
  });

  it('rejects numbers below the declared minimum', () => {
    const out = normalizeSettings({ referral_on_time_target: 0 }); // min 1
    expect('referral_on_time_target' in out).toBe(false);
  });

  it('ignores unknown keys', () => {
    const out = normalizeSettings({ hacker_field: 'x', referral_bonus_amount: 500 });
    expect(out).toEqual({ referral_bonus_amount: 500 });
  });
});
