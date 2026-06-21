import { PREMIUM_PALETTES } from '@/lib/palettes';

/**
 * Selector de paletas premium predefinidas.
 *
 * Muestra cada paleta como una fila de muestras de color; al hacer clic llama a
 * `onSelect({ primary, secondary, accent, background })`. Se usa tanto en el
 * onboarding como en el editor de marca del Admin para que aplicar un look
 * profesional sea un solo toque.
 *
 * @param {{ onSelect: (palette: { primary: string, secondary: string, accent: string, background: string }) => void }} props
 */
export default function PalettePresets({ onSelect }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Paletas premium</p>
      <div className="grid grid-cols-2 gap-2">
        {PREMIUM_PALETTES.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => onSelect({ primary: p.primary, secondary: p.secondary, accent: p.accent, background: p.background })}
            className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-2 text-left hover:border-primary/60 transition-colors"
            title={`Aplicar paleta ${p.name}`}
          >
            <span className="flex shrink-0 -space-x-1">
              {[p.background, p.primary, p.accent, p.secondary].map((c, i) => (
                <span key={i} className="w-4 h-4 rounded-full border border-border" style={{ background: c }} />
              ))}
            </span>
            <span className="text-xs text-foreground truncate">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
