import { cn } from '@/lib/utils';

/**
 * Encabezado de página consistente: título, subtítulo opcional y un espacio de
 * acción a la derecha. Unifica el `<div className="flex justify-between mb-5">`
 * que cada página reimplementaba con pequeñas variaciones.
 *
 * @param {{
 *   title: string,
 *   subtitle?: import('react').ReactNode,
 *   action?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function PageHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {/* Full width on mobile (stacked below the title) so a wide action slot — e.g.
          Reportes' range/visibility toolbar — never squeezes the title into a
          single-word column; back to an inline shrink-0 slot from `sm` up. */}
      {action && <div className="sm:shrink-0">{action}</div>}
    </div>
  );
}
