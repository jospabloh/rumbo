import { Truck } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import RegistrarMenu from '@/components/reports/RegistrarMenu';

const statusLabel = { active: 'Activa', maintenance: 'Mantenimiento', inactive: 'De baja' };
const statusColor = { active: 'bg-success/10 text-success', maintenance: 'bg-warning/10 text-warning', inactive: 'bg-muted text-muted-foreground' };

/**
 * Tarjetas de unidades visibles con sus métricas del rango. Clic en el cuerpo
 * de la tarjeta abre el historial completo (UnitDrilldown); el botón
 * "Registrar" (RegistrarMenu, compartido con UnitDayCellDetail) da de alta un
 * ingreso/gasto/mantenimiento para HOY sin tener que abrir antes una celda de
 * la matriz.
 *
 * @param {{ vehicles: any[], driverById: (id:string)=>any, onSelect: (vehicleId:string)=>void }} props
 */
export default function UnitCardGrid({ vehicles, driverById, onSelect }) {
  if (vehicles.length === 0) {
    return <EmptyState icon={Truck} title="Sin unidades visibles" description="Ajusta el selector de unidades para ver tarjetas aquí." />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {vehicles.map((v) => {
        const driver = driverById(v.assigned_driver_id);
        return (
          <div key={v.vehicle_id} className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/50 transition-colors">
            <button onClick={() => onSelect(v.vehicle_id)} className="w-full text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{v.plate || `#${v.unit_number}`}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusColor[v.status]}`}>{statusLabel[v.status]}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Utilidad/día<b className="block text-sm text-foreground font-mono">{v.profit_per_active_day != null ? `$${Math.round(v.profit_per_active_day).toLocaleString()}` : '—'}</b></div>
                <div>Costo/km<b className="block text-sm text-foreground font-mono">{v.cost_per_km != null ? `$${v.cost_per_km.toFixed(2)}` : '—'}</b></div>
                <div>Km recorridos<b className="block text-sm text-foreground font-mono">{v.km_traveled != null ? v.km_traveled.toLocaleString() : '—'}</b></div>
                <div>Conductor<b className="block text-sm text-foreground truncate">{driver?.full_name || 'Sin asignar'}</b></div>
              </div>
              {v.below_range && <p className="mt-2 text-[11px] font-bold text-destructive">⚠ Bajo rango de la flota</p>}
            </button>
            <div className="mt-3 pt-3 border-t border-border flex justify-end">
              <RegistrarMenu vehicleId={v.vehicle_id} plate={v.plate} unitNumber={v.unit_number} driverId={v.assigned_driver_id} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
