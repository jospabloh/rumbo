import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useVehicles } from '@/hooks/useEntities';
import { useFleetUnitMetrics, useUnitVisibility } from '@/hooks/useFleetMetrics';
import { resolveRange } from '@/lib/fleetMetricsRange';
import UnitProfitMatrix from '@/components/reports/UnitProfitMatrix';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Vista previa de la matriz utilidad × unidad en el Dashboard (siempre semana
 * en curso, sin controles de rango/visibilidad — esos viven en /reports).
 * Clic en una celda navega al detalle completo de esa unidad/día en /reports.
 * Solo se monta para owner/admin (ver Dashboard.jsx) — fleetUnitMetrics es
 * 403 para otros roles.
 */
export default function FleetProfitMatrixCard() {
  const navigate = useNavigate();
  const weekRange = useMemo(() => resolveRange('week', {}, new Date()), []);
  const { data: vehicles = [] } = useVehicles();
  const { hiddenIds } = useUnitVisibility();
  const visibleVehicleIds = hiddenIds.length ? vehicles.filter((v) => !hiddenIds.includes(v.id)).map((v) => v.id) : null;
  const { data, isLoading } = useFleetUnitMetrics(weekRange, visibleVehicleIds, { trailingPeriods: 0 });

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">Utilidad por unidad · esta semana</h2>
        <button onClick={() => navigate('/reports')} className="text-xs text-primary flex items-center gap-1 hover:underline">
          Ver reporte completo<ArrowRight className="w-3 h-3" />
        </button>
      </div>
      {isLoading || !data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <UnitProfitMatrix
          range={weekRange}
          vehicles={data.vehicles}
          selected={null}
          onSelectCell={(vehicleId, bucket) => navigate(`/reports?range=week&vehicle=${vehicleId}&date=${bucket.dates[0]}`)}
        />
      )}
    </div>
  );
}
