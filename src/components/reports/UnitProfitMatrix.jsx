import { Fragment, useMemo } from 'react';
import { bucketRangeDates, cellsForVehicle } from '@/lib/fleetMetricsRange';
import { EmptyState } from '@/components/ui/empty-state';
import { LayoutGrid } from 'lucide-react';

const RAMP = ['hsl(var(--seq-1))', 'hsl(var(--seq-2))', 'hsl(var(--seq-3))', 'hsl(var(--seq-4))', 'hsl(var(--seq-5))'];

function bucketColor(value, max) {
  if (max <= 0) return RAMP[0];
  const r = value / max;
  const idx = r > 0.85 ? 4 : r > 0.6 ? 3 : r > 0.35 ? 2 : r > 0.12 ? 1 : 0;
  return RAMP[idx];
}

function fmtCompact(n) {
  const abs = Math.abs(n);
  return abs >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString();
}

const statusDot = { active: 'bg-success', maintenance: 'bg-warning', inactive: 'bg-muted-foreground' };

/**
 * Matriz día × unidad — el elemento central de /reports. Filas = bucket de
 * tiempo (día de la semana en vista Semana, semana del mes en Mes, mes en
 * Año); columnas = unidades visibles; celda = utilidad del periodo, con
 * "Total día" y "Total unidad" en los márgenes. Clic en una celda selecciona
 * (vehicleId, bucket) para el panel de detalle (UnitDayCellDetail).
 *
 * @param {{
 *   range: object, vehicles: any[], selected: {vehicleId:string, bucketKey:string}|null,
 *   onSelectCell: (vehicleId: string, bucket: object) => void,
 * }} props
 */
export default function UnitProfitMatrix({ range, vehicles, selected, onSelectCell }) {
  const buckets = useMemo(() => bucketRangeDates(range), [range]);

  const perVehicle = useMemo(() => vehicles.map((v) => {
    const cells = cellsForVehicle(v, buckets);
    return { vehicle: v, cells, total: cells.reduce((s, c) => s + c.profit, 0) };
  }), [vehicles, buckets]);

  if (vehicles.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <EmptyState icon={LayoutGrid} title="Sin unidades visibles" description="Usa el selector de unidades para elegir cuáles quieres seguir en este tablero." />
      </div>
    );
  }

  const maxProfit = Math.max(1, ...perVehicle.flatMap((pv) => pv.cells.map((c) => (pv.vehicle.status === 'active' ? c.profit : -Infinity))).filter(Number.isFinite));
  const rowTotals = buckets.map((b, i) => perVehicle.reduce((s, pv) => s + (pv.vehicle.status === 'active' ? pv.cells[i].profit : 0), 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="overflow-x-auto">
        <div className="grid gap-1 min-w-max" style={{ gridTemplateColumns: `88px repeat(${vehicles.length}, minmax(64px, 1fr)) 80px` }}>
          <div />
          {perVehicle.map(({ vehicle }) => (
            <div key={vehicle.vehicle_id} className="text-xs font-bold text-center pb-1.5 truncate flex items-center justify-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[vehicle.status] || 'bg-muted-foreground'}`} />
              {vehicle.plate || `#${vehicle.unit_number}`}
            </div>
          ))}
          <div className="text-[10px] text-muted-foreground text-center pb-1.5">Total</div>

          {buckets.map((b, i) => (
            <Fragment key={b.key}>
              <div className="text-xs font-bold text-muted-foreground flex items-center">{b.label}</div>
              {perVehicle.map(({ vehicle, cells }) => {
                const cell = cells[i];
                const inactive = vehicle.status !== 'active';
                const isSelected = selected?.vehicleId === vehicle.vehicle_id && selected?.bucketKey === b.key;
                return (
                  <button
                    key={`${b.key}-${vehicle.vehicle_id}`}
                    onClick={() => onSelectCell(vehicle.vehicle_id, b)}
                    className={`h-9 rounded-md flex items-center justify-center text-[11px] font-bold font-mono transition-all border-2 ${
                      isSelected ? 'border-foreground' : 'border-transparent hover:border-foreground/25'
                    } ${inactive ? 'bg-secondary/60 text-muted-foreground' : 'text-foreground'}`}
                    style={inactive ? undefined : { background: bucketColor(cell.profit, maxProfit) }}
                    title={inactive ? `${vehicle.status === 'maintenance' ? 'En mantenimiento' : 'De baja'}` : `Utilidad $${Math.round(cell.profit).toLocaleString()}`}
                  >
                    {inactive ? '—' : fmtCompact(cell.profit)}
                  </button>
                );
              })}
              <div className="h-9 rounded-md bg-secondary flex items-center justify-center text-[11px] font-bold font-mono">
                ${fmtCompact(rowTotals[i])}
              </div>
            </Fragment>
          ))}

          <div className="text-xs font-bold pt-1.5">Total unidad</div>
          {perVehicle.map(({ vehicle, total }) => (
            <div key={`${vehicle.vehicle_id}-total`} className="text-[11px] font-bold font-mono text-center pt-1.5">
              {vehicle.status === 'active' ? `$${fmtCompact(total)}` : '—'}
            </div>
          ))}
          <div className="text-[11px] font-bold font-mono text-center pt-1.5 text-primary">${fmtCompact(grandTotal)}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-foreground">
        <span>Menos</span>
        {RAMP.map((c) => <span key={c} className="w-4 h-2.5 rounded-sm" style={{ background: c }} />)}
        <span>Más utilidad</span>
        <span className="ml-4 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-warning" />mantenimiento</span>
        <span className="ml-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />de baja</span>
      </div>
    </div>
  );
}
