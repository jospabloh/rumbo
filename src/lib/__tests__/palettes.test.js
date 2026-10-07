import { describe, it, expect } from 'vitest';
import { PREMIUM_PALETTES, isValidHex, hexToHsl, applyTenantColors, contrastRatio, foregroundFor, foregroundHexFor, renderedHex } from '@/lib/palettes';

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
  // El color de marca rellena botones (text-xs/text-sm) y el ítem activo del
  // menú (text-sm): texto normal, así que la regla es WCAG AA, 4.5:1.
  it('toda paleta incluida llega a 4.5:1 con el texto elegido', () => {
    for (const p of PREMIUM_PALETTES) {
      expect(contrastRatio(renderedHex(p.primary), foregroundHexFor(p.primary)), p.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Un tenant puede poner cualquier color a mano: barrido de matices y luces,
  // incluido el peor caso (un color a medio camino entre blanco y la tinta).
  it('cualquier color de marca llega a 4.5:1, no solo las paletas', () => {
    const hex = (n) => n.toString(16).padStart(2, '0');
    for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
      const c = `#${hex(r)}${hex(g)}${hex(b)}`;
      expect(contrastRatio(renderedHex(c), foregroundHexFor(c)), c).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Lo que se mide es el color pintado (HSL redondeado), no el hex que eligió el
  // tenant: #007db5 elegía negro con su hex y daba 4.43:1 sobre lo pintado.
  it('elige contra el color redondeado que se pinta', () => {
    expect(foregroundFor('#007db5')).toBe('0 0% 100%');
    expect(contrastRatio(renderedHex('#007db5'), foregroundHexFor('#007db5'))).toBeGreaterThanOrEqual(4.5);
  });

  it('los colores oscuros conservan el texto blanco', () => {
    expect(foregroundFor('#1d4ed8')).toBe('0 0% 100%');
    expect(foregroundFor('#64748b')).toBe('0 0% 100%'); // Grafito
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
