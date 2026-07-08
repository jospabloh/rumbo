import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useVehicles, useDrivers, useEntityList } from '@/hooks/useEntities';
import { useFleetUnitMetrics, useUnitVisibility } from '@/hooks/useFleetMetrics';
import { resolveRange, bucketRangeDates } from '@/lib/fleetMetricsRange';
import RangeSegmentedControl from '@/components/reports/RangeSegmentedControl';
import UnitVisibilitySelector from '@/components/reports/UnitVisibilitySelector';
import RentArrearsBanner from '@/components/reports/RentArrearsBanner';
import KpiRow from '@/components/reports/KpiRow';
import UnitProfitMatrix from '@/components/reports/UnitProfitMatrix';
import UnitDayCellDetail from '@/components/reports/UnitDayCellDetail';
import ProductivityRankings from '@/components/reports/ProductivityRankings';
import CostPerKmComparison from '@/components/reports/CostPerKmComparison';
import MaintenanceCategoryBreakdown from '@/components/reports/MaintenanceCategoryBreakdown';
import PredictiveAnalytics from '@/components/reports/PredictiveAnalytics';
import UnitCardGrid from '@/components/reports/UnitCardGrid';
import UnitDrilldown from '@/components/reports/UnitDrilldown';

export default function FleetMetrics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rangeType = searchParams.get('range') || 'week';
  const customRange = { start: searchParams.get('start'), end: searchParams.get('end') };
  const range = useMemo(() => resolveRange(rangeType, customRange, new Date()), [rangeType, customRange.start, customRange.end]);

  const { data: vehicles = [] } = useVehicles();
  const { data: drivers = [] } = useDrivers();
  const { data: allMaintenance = [] } = useEntityList('Maintenance');
  const { data: allRentCharges = [] } = useEntityList('RentCharge');
  const { hiddenIds, toggleVehicle, setHiddenIds } = useUnitVisibility();

  const visibleVehicleIds = hiddenIds.length ? vehicles.filter((v) => !hiddenIds.includes(v.id)).map((v) => v.id) : null;
  const { data, isLoading } = useFleetUnitMetrics(range, visibleVehicleIds);

  const [selectedCell, setSelectedCell] = useState(null); // { vehicleId, bucket }
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const detailRef = useRef(null);

  // Deep-link desde la vista previa del Dashboard (?vehicle=&date=): abre
  // directamente el detalle de esa unidad/día en cuanto llegan los datos.
  useEffect(() => {
    if (selectedCell || !data) return;
    const vehicleId = searchParams.get('vehicle');
    const dateParam = searchParams.get('date');
    if (!vehicleId || !dateParam) return;
    const bucket = bucketRangeDates(range).find((b) => b.dates.includes(dateParam));
    if (bucket) setSelectedCell({ vehicleId, bucket });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (selectedCell) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedCell]);

  const driverById = (id) => drivers.find((d) => d.id === id);

  const onRangeChange = (type, custom) => {
    const next = new URLSearchParams(searchParams);
    next.set('range', type);
    if (type === 'custom' && custom) { next.set('start', custom.start); next.set('end', custom.end); }
    else { next.delete('start'); next.delete('end'); }
    setSearchParams(next, { replace: true });
    setSelectedCell(null);
  };

  if (isLoading || !data) {
    return (
      <div className="p-4 lg:p-6">
        <PageHeader title="Reportes" subtitle="Utilidad, ranking y pronóstico por unidad" />
        <ListSkeleton />
      </div>
    );
  }

  const vehiclesOut = data.vehicles;
  const buckets = bucketRangeDates(range);
  const selectedVehicle = selectedUnitId ? vehiclesOut.find((v) => v.vehicle_id === selectedUnitId) : null;
  const selectedCellVehicle = selectedCell ? vehiclesOut.find((v) => v.vehicle_id === selectedCell.vehicleId) : null;

  const unitRankRows = vehiclesOut
    .filter((v) => v.status === 'active')
    .map((v) => ({ id: v.vehicle_id, label: v.plate || `#${v.unit_number}`, value: v.profit_per_active_day, belowRange: v.below_range }));
  const driverRankRows = (data.fleet.driver_rows || [])
    .map((d) => ({
      id: d.driver_id, label: d.full_name, value: d.profit_per_active_day,
      belowRange: data.fleet.median_profit_per_active_day != null && d.profit_per_active_day < data.fleet.median_profit_per_active_day * (data.fleet.below_range_ratio || 0.7),
    }));

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Reportes"
        subtitle="Utilidad, ranking y pronóstico por unidad"
        action={(
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <RangeSegmentedControl type={rangeType} custom={customRange} range={range} onChange={onRangeChange} />
            <UnitVisibilitySelector vehicles={vehicles} hiddenIds={hiddenIds} onToggle={toggleVehicle} onSetHidden={setHiddenIds} />
          </div>
        )}
      />

      <RentArrearsBanner />
      <KpiRow fleet={data.fleet} vehicles={vehiclesOut} />

      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-semibold text-sm">Utilidad por periodo × unidad</h2>
      </div>
      <div className="mb-4">
        <UnitProfitMatrix
          range={range}
          vehicles={vehiclesOut}
          selected={selectedCell ? { vehicleId: selectedCell.vehicleId, bucketKey: selectedCell.bucket.key } : null}
          onSelectCell={(vehicleId, bucket) => setSelectedCell({ vehicleId, bucket })}
        />
      </div>

      {selectedCell && selectedCellVehicle && (
        <div className="mb-4" ref={detailRef}>
          <UnitDayCellDetail
            vehicle={selectedCellVehicle}
            bucket={selectedCell.bucket}
            buckets={buckets}
            vehicles={vehiclesOut}
            driverName={driverById(selectedCellVehicle.assigned_driver_id)?.full_name}
            maintenance={allMaintenance}
            rentCharges={allRentCharges}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="space-y-4">
          <ProductivityRankings title="Unidades" sub="Utilidad/día activo (visibles)" rows={unitRankRows} />
          <ProductivityRankings title="Conductores" sub="Utilidad/día activo (flota completa)" rows={driverRankRows} />
        </div>
        <div className="space-y-4">
          <CostPerKmComparison vehicles={vehiclesOut} />
          <MaintenanceCategoryBreakdown byKind={data.fleet.maintenance_by_kind} byCategory={data.fleet.maintenance_by_category} />
        </div>
      </div>

      <div className="mb-1"><h2 className="font-semibold text-sm">Analítica predictiva por unidad</h2></div>
      <div className="mb-4"><PredictiveAnalytics vehicles={vehiclesOut} /></div>

      <div className="mb-1"><h2 className="font-semibold text-sm">Unidades visibles</h2></div>
      {selectedVehicle ? (
        <UnitDrilldown vehicle={selectedVehicle} driverName={driverById(selectedVehicle.assigned_driver_id)?.full_name} onBack={() => setSelectedUnitId(null)} />
      ) : (
        <UnitCardGrid vehicles={vehiclesOut} driverById={driverById} onSelect={setSelectedUnitId} />
      )}
    </div>
  );
}
