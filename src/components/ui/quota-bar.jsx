// Módulo 27 — el cupo del plan como "barra de vida": un bloque por unidad
// cuando el límite es lo bastante chico para contarse de un vistazo (≤ 30), una
// barra continua si es más grande, y nada si el plan es ilimitado. El color
// avisa antes de que el cupo se acabe: verde, ámbar al 80 %, rojo lleno.
import { quotaTone } from '@/lib/plans';

const BLOCK_LIMIT = 30;

const FILL = {
  ok: 'hsl(var(--success))',
  near: 'hsl(var(--warning))',
  full: 'hsl(var(--destructive))',
};

export default function QuotaBar({ used, limit, label }) {
  if (!Number.isFinite(limit) || limit <= 0) return null;
  const tone = quotaTone(used, limit);
  // Variables CSS en línea: React las acepta, el tipo de `style` no las conoce.
  // Los bloques vacíos van en el color de tarjeta: la barra vive sobre una ficha
  // teñida (bg-secondary), y en el color de --play-track (= muted = secondary)
  // los vacíos desaparecían y "2 de 15" se leía como dos bloques nada más.
  const style = /** @type {React.CSSProperties} */ ({ '--play-hp-fill': FILL[tone], '--play-track': 'hsl(var(--card))' });
  const aria = label || `${used} de ${limit}`;

  if (limit <= BLOCK_LIMIT) {
    return (
      <div className="play-hp mt-2" style={/** @type {React.CSSProperties} */ ({ ...style, '--play-hp-total': limit })} role="img" aria-label={aria}>
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} data-on={i < used ? '' : undefined} />
        ))}
      </div>
    );
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="mt-2 h-3 rounded-full bg-card overflow-hidden" role="img" aria-label={aria}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: FILL[tone] }} />
    </div>
  );
}
