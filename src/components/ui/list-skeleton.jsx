import { Skeleton } from '@/components/ui/skeleton';

/**
 * Esqueleto de carga para listas de tarjetas (Conductores, Vehículos, Alertas…).
 *
 * Sustituye el spinner centrado por marcadores con la forma real del contenido,
 * lo que hace que la carga se perciba más rápida y evita el salto de layout
 * cuando llegan los datos.
 *
 * @param {{ rows?: number }} props
 */
export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-2" role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-4 w-4 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}
