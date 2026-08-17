/**
 * Paletas premium predefinidas para el branding del tenant.
 *
 * Complementan la extracción de colores del logo con IA: si una organización no
 * tiene logo a la mano (o quiere un look más cuidado), puede elegir una paleta
 * profesional de un clic. Cada paleta está afinada para la estética "consola de
 * operaciones" de Rumbo (fondos oscuros, primario con buen contraste).
 *
 * Las claves coinciden con las que consume `applyTenantColors` y el formulario
 * del tenant: primary / secondary / accent / background (hex).
 */
export const PREMIUM_PALETTES = [
  { name: 'Azul ejecutivo', primary: '#3b82f6', secondary: '#1e293b', accent: '#60a5fa', background: '#0b1120' },
  { name: 'Esmeralda',      primary: '#10b981', secondary: '#1f2937', accent: '#34d399', background: '#0a0f0d' },
  { name: 'Violeta real',   primary: '#8b5cf6', secondary: '#241f33', accent: '#a78bfa', background: '#100b1a' },
  { name: 'Ámbar industrial', primary: '#f59e0b', secondary: '#292524', accent: '#fbbf24', background: '#1a1410' },
  { name: 'Carmesí',        primary: '#ef4444', secondary: '#2a1a1a', accent: '#f87171', background: '#160d0d' },
  { name: 'Cian profundo',  primary: '#06b6d4', secondary: '#143138', accent: '#22d3ee', background: '#08161a' },
  { name: 'Grafito',        primary: '#64748b', secondary: '#1e293b', accent: '#94a3b8', background: '#0c1119' },
  { name: 'Rosa neón',      primary: '#ec4899', secondary: '#2a1622', accent: '#f472b6', background: '#170b12' },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** True si `value` es un color hex de 6 dígitos válido (#RRGGBB). */
export function isValidHex(value) {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

/** Convierte un color hex (#RRGGBB) a la tripleta "H S% L%" que usan las custom
 * properties de Tailwind/shadcn (--primary, --background, etc.). */
export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Aplica la paleta del tenant (primary/background/secondary, hex) como custom
 * properties CSS en :root. Vive aquí (no en la página de onboarding) porque
 * Layout.jsx la necesita en cada carga de la app, no solo durante el onboarding. */
export function applyTenantColors(colors) {
  if (!colors) return;
  const root = document.documentElement;
  if (colors.primary) {
    try {
      const hsl = hexToHsl(colors.primary);
      root.style.setProperty('--primary', hsl);
      root.style.setProperty('--ring', hsl);
      root.style.setProperty('--sidebar-primary', hsl);
      root.style.setProperty('--sidebar-ring', hsl);
    } catch (e) {}
  }
  if (colors.background) {
    try {
      const hsl = hexToHsl(colors.background);
      root.style.setProperty('--background', hsl);
      root.style.setProperty('--sidebar-background', hsl);
    } catch (e) {}
  }
  if (colors.secondary) {
    try {
      const hsl = hexToHsl(colors.secondary);
      root.style.setProperty('--secondary', hsl);
      root.style.setProperty('--muted', hsl);
    } catch (e) {}
  }
}
