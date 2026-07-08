import { DollarSign, TrendingUp, Gauge, Award, AlertTriangle, User } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';

/**
 * Fila de KPIs de flota — composición delgada sobre StatCard (mismo tile que
 * usa el Dashboard), sin un componente de tarjeta nuevo.
 *
 * @param {{ fleet: any, vehicles?: any[] }} props  `data.fleet`/`data.vehicles` de fleetUnitMetrics.
 */
export default function KpiRow({ fleet, vehicles = [] }) {
  if (!fleet) return null;

  const costRows = vehicles.filter((v) => v.cost_per_km != null);
  const avgCostPerKm = costRows.length ? costRows.reduce((s, v) => s + v.cost_per_km, 0) / costRows.length : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
      <StatCard icon={TrendingUp} label="Utilidad de flota" value={`$${Math.round(fleet.total_profit).toLocaleString()}`} sub={`${fleet.vehicle_count} unidades`} color="green" />
      <StatCard icon={DollarSign} label="Ingreso de flota" value={`$${Math.round(fleet.total_revenue).toLocaleString()}`} sub={`$${Math.round(fleet.total_cost).toLocaleString()} en costos`} color="blue" />
      <StatCard icon={Gauge} label="Unidades activas" value={fleet.active_vehicle_count} sub={`de ${fleet.vehicle_count} en total`} color="gray" />
      <StatCard icon={Gauge} label="Costo / km promedio" value={avgCostPerKm != null ? `$${avgCostPerKm.toFixed(2)}` : '—'} sub={`${costRows.length} unidades con dato`} color="gray" />
      <StatCard
        icon={Award}
        label="Unidad más productiva"
        value={fleet.most_productive_vehicle?.plate || '—'}
        sub={fleet.most_productive_vehicle ? `$${Math.round(fleet.most_productive_vehicle.profit_per_active_day).toLocaleString()} utilidad/día` : undefined}
        color="green"
      />
      <StatCard
        icon={AlertTriangle}
        label="Unidades bajo rango"
        value={fleet.below_range_vehicle_ids?.length || 0}
        sub={`< ${Math.round((fleet.below_range_ratio || 0.7) * 100)}% de la mediana`}
        color={fleet.below_range_vehicle_ids?.length ? 'red' : 'gray'}
      />
      <StatCard
        icon={User}
        label="Conductor más productivo"
        value={fleet.most_productive_driver?.full_name || '—'}
        sub={fleet.most_productive_driver ? `$${Math.round(fleet.most_productive_driver.profit_per_active_day).toLocaleString()}/día` : undefined}
        color="blue"
      />
    </div>
  );
}
