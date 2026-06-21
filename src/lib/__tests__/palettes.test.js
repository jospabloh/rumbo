import { describe, it, expect } from 'vitest';
import { PREMIUM_PALETTES, isValidHex } from '@/lib/palettes';

describe('PREMIUM_PALETTES', () => {
  it('offers several curated palettes', () => {
    expect(PREMIUM_PALETTES.length).toBeGreaterThanOrEqual(6);
  });

  it('every palette has a name and 4 valid hex colors', () => {
    for (const p of PREMIUM_PALETTES) {
      expect(p.name).toBeTruthy();
      for (const key of ['primary', 'secondary', 'accent', 'background']) {
        expect(isValidHex(p[key])).toBe(true);
      }
    }
  });

  it('palette names are unique', () => {
    const names = PREMIUM_PALETTES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('isValidHex', () => {
  it('accepts #RRGGBB', () => {
    expect(isValidHex('#3b82f6')).toBe(true);
    expect(isValidHex('#FFFFFF')).toBe(true);
  });
  it('rejects malformed values', () => {
    expect(isValidHex('3b82f6')).toBe(false);
    expect(isValidHex('#fff')).toBe(false);
    expect(isValidHex('#zzzzzz')).toBe(false);
    expect(isValidHex('')).toBe(false);
    expect(isValidHex(null)).toBe(false);
  });
});
