import { cn } from '@/lib/utils';

/**
 * Estado vacío consistente para listas y paneles.
 *
 * Reemplaza el `<p className="text-center text-muted-foreground py-10">Sin
 * registros</p>` copiado en cada página por un bloque con icono, título y una
 * acción opcional, para que "vacío" se sienta intencional y no roto.
 *
 * @param {{
 *   icon?: any,
 *   title: string,
 *   description?: string,
 *   action?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-4', className)}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
