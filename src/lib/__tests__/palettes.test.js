import { describe, it, expect } from 'vitest';
import { PREMIUM_PALETTES, isValidHex, hexToHsl, applyTenantColors, contrastRatio, foregroundFor } from '@/lib/palettes';

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

// Moved here from src/pages/TenantOnboarding.jsx (audit/rumbo-full-review):
// Layout.jsx — a core, always-loaded component — depended on a one-time
// onboarding-wizard page just for this color-math helper. Same behavior,
// now in the right module and actually unit-testable.
describe('hexToHsl', () => {
  it('converts pure colors to their known HSL triplet', () => {
    expect(hexToHsl('#ff0000')).toBe('0 100% 50%');
    expect(hexToHsl('#00ff00')).toBe('120 100% 50%');
    expect(hexToHsl('#0000ff')).toBe('240 100% 50%');
  });

  it('converts black/white/gray without divide-by-zero (max === min branch)', () => {
    expect(hexToHsl('#000000')).toBe('0 0% 0%');
    expect(hexToHsl('#ffffff')).toBe('0 0% 100%');
    expect(hexToHsl('#808080')).toBe('0 0% 50%');
  });

  it('matches every PREMIUM_PALETTES color parsing without throwing', () => {
    for (const p of PREMIUM_PALETTES) {
      for (const key of ['primary', 'secondary', 'accent', 'background']) {
        const hsl = hexToHsl(p[key]);
        expect(hsl).toMatch(/^\d+ \d+% \d+%$/);
      }
    }
  });
});

describe('applyTenantColors', () => {
  it('is a no-op when colors is null/undefined (no root style calls)', () => {
    document.documentElement.style.cssText = '';
    applyTenantColors(null);
    applyTenantColors(undefined);
    expect(document.documentElement.style.cssText).toBe('');
  });

  it('sets primary/ring/sidebar custom properties when primary is given', () => {
    document.documentElement.style.cssText = '';
    applyTenantColors({ primary: '#3b82f6' });
    const root = document.documentElement.style;
    const expected = hexToHsl('#3b82f6');
    expect(root.getPropertyValue('--primary').trim()).toBe(expected);
    expect(root.getPropertyValue('--ring').trim()).toBe(expected);
    expect(root.getPropertyValue('--sidebar-primary').trim()).toBe(expected);
    expect(root.getPropertyValue('--sidebar-ring').trim()).toBe(expected);
  });

  it('sets background/sidebar-background when background is given', () => {
    document.documentElement.style.cssText = '';
    applyTenantColors({ background: '#0b1120' });
    const root = document.documentElement.style;
    const expected = hexToHsl('#0b1120');
    expect(root.getPropertyValue('--background').trim()).toBe(expected);
    expect(root.getPropertyValue('--sidebar-background').trim()).toBe(expected);
  });

  it('sets secondary/muted when secondary is given', () => {
    document.documentElement.style.cssText = '';
    applyTenantColors({ secondary: '#1e293b' });
    const root = document.documentElement.style;
    const expected = hexToHsl('#1e293b');
    expect(root.getPropertyValue('--secondary').trim()).toBe(expected);
    expect(root.getPropertyValue('--muted').trim()).toBe(expected);
  });

  it('leaves other properties untouched when a key is absent', () => {
    document.documentElement.style.cssText = '';
    applyTenantColors({ primary: '#3b82f6' });
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('');
  });
});

describe('foregroundFor() — el texto sobre el color de marca siempre se lee', () => {
  // Con Esmeralda, Ámbar o Cian el blanco quedaba en 2.1–2.5:1 sobre botones y
  // sobre el ítem activo del menú (mario_style lo rellena con --primary).
  it('cambia a tinta oscura en las paletas claras', () => {
    for (const name of ['Esmeralda', 'Ámbar industrial', 'Cian profundo']) {
      const p = PREMIUM_PALETTES.find((x) => x.name === name);
      expect(contrastRatio(p.primary, '#ffffff')).toBeLessThan(3);
      expect(foregroundFor(p.primary)).not.toBe('0 0% 100%');
    }
  });

  // El resto conserva el blanco de siempre: no se cambia el look de quien ya se leía.
  it('deja el blanco donde ya llega a 3:1', () => {
    for (const name of ['Azul ejecutivo', 'Violeta real', 'Carmesí', 'Grafito', 'Rosa neón']) {
      const p = PREMIUM_PALETTES.find((x) => x.name === name);
      expect(foregroundFor(p.primary)).toBe('0 0% 100%');
    }
  });

  it('applyTenantColors fija el texto del botón y del menú junto con el primario', () => {
    document.documentElement.style.cssText = '';
    applyTenantColors({ primary: '#f59e0b' });
    const root = document.documentElement.style;
    expect(root.getPropertyValue('--primary-foreground').trim()).toBe(foregroundFor('#f59e0b'));
    expect(root.getPropertyValue('--sidebar-primary-foreground').trim()).toBe(foregroundFor('#f59e0b'));
    expect(root.getPropertyValue('--primary-foreground').trim()).not.toBe('0 0% 100%');
  });
});
