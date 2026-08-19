import { useMemo } from 'react';
import { MapPin, FileText } from 'lucide-react';
import { cellsForVehicle } from '@/lib/fleetMetricsRange';
import { useTenant } from '@/lib/TenantContext';
import { useInvalidateEntity } from '@/hooks/useEntities';
import { useUnitDayNotes } from '@/hooks/useFleetMetrics';
import RegistrarMenu from '@/components/reports/RegistrarMenu';
import NoteComposer from '@/components/reports/NoteComposer';
import { guardedCreate } from '@/lib/guardedWrite';

/**
 * Detalle de una celda de la matriz día × unidad: ingreso/gasto/utilidad del
 * bucket seleccionado, comentarios (UnitDayNote propios + notas de pago y
 * mantenimiento que cayeron ese día) e insights calculados en cliente a
 * partir de los mismos datos que ya trae fleetUnitMetrics (sin lógica de
 * "insight" en el servidor). El botón "Registrar" (RegistrarMenu, compartido
 * con UnitCardGrid) permite dar de alta un ingreso/gasto/mantenimiento para
 * esta unidad en este día exacto.
 *
 * @param {{
 *   vehicle: any, bucket: {key:string,label:string,dates:string[]}, buckets: any[],
 *   vehicles: any[], driverName?: string, maintenance: any[], rentCharges: any[],
 * }} props
 */
export default function UnitDayCellDetail({ vehicle, bucket, buckets, vehicles, driverName, maintenance, rentCharges }) {
  const { tenantId } = useTenant();
  const { data: notes = [] } = useUnitDayNotes(vehicle.vehicle_id);
  const invalidate = useInvalidateEntity();

  const date = bucket.dates[0];

  const cell = useMemo(() => cellsForVehicle(vehicle, [bucket])[0], [vehicle, bucket]);
  const ownCells = useMemo(() => cellsForVehicle(vehicle, buckets), [vehicle, buckets]);
  const bucketIndex = buckets.findIndex((b) => b.key === bucket.key);

  const isBest = vehicle.status === 'active' && ownCells.length > 1
    && cell.profit === Math.max(...ownCells.map((c) => c.profit));

  const fleetCellsAtBucket = vehicles
    .filter((v) => v.vehicle_id !== vehicle.vehicle_id && v.status === 'active')
    .map((v) => cellsForVehicle(v, [bucket])[0].profit);
  const fleetAvg = fleetCellsAtBucket.length ? fleetCellsAtBucket.reduce((a, b) => a + b, 0) / fleetCellsAtBucket.length : null;
  const vsFleetPct = fleetAvg ? Math.round(((cell.profit - fleetAvg) / Math.abs(fleetAvg)) * 100) : null;

  const ownAvg = ownCells.length ? ownCells.reduce((s, c) => s + c.profit, 0) / ownCells.length : 0;
  let streak = 0;
  for (let i = bucketIndex; i >= 0 && ownCells[i].profit >= ownAvg; i--) streak++;

  const highCost = cell.revenue > 0 && cell.cost > cell.revenue * 0.35;

  const dateNotes = notes.filter((n) => bucket.dates.includes(n.note_date))
    .map((n) => ({ id: n.id, text: `"${n.text}"`, attachments: n.attachments || [] }));
  const maintNotes = (maintenance || [])
    .filter((m) => m.vehicle_id === vehicle.vehicle_id && bucket.dates.includes(String(m.performed_at).slice(0, 10)) && m.description)
    .map((m) => ({ id: m.id, text: `"${m.description}" — nota de mantenimiento`, attachments: [] }));
  const paymentNotes = (rentCharges || [])
    .filter((c) => c.vehicle_id === vehicle.vehicle_id)
    .flatMap((c) => (c.payments || []).filter((p) => p.note && bucket.dates.includes(p.paid_at)))
    .map((p, i) => ({ id: `pay-${i}`, text: `"${p.note}" — nota de pago`, attachments: [] }));
  const allNotes = [...dateNotes, ...maintNotes, ...paymentNotes];

  const addNote = async (text, attachments) => {
    if (!text || !tenantId) return;
    await guardedCreate('UnitDayNote', {
      vehicle_id: vehicle.vehicle_id,
      note_date: date,
      text,
      attachments,
    });
    invalidate('UnitDayNote');
  };

  const registrarMenu = (
    <RegistrarMenu
      vehicleId={vehicle.vehicle_id}
      plate={vehicle.plate}
      unitNumber={vehicle.unit_number}
      driverId={vehicle.assigned_driver_id}
      date={date}
    />
  );

  const gpsPlaceholder = (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 rounded-full px-2.5 py-1 cursor-not-allowed"
      title="Ubicación en vivo vía Rainde (proveedor de GPS) — integración pendiente"
    >
      <MapPin className="w-3.5 h-3.5" />GPS (Rainde) · Próximamente
    </span>
  );

  if (vehicle.status !== 'active') {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <p className="text-sm font-semibold">{bucket.label} · {vehicle.plate} · {vehicle.status === 'maintenance' ? 'En mantenimiento' : 'De baja'}</p>
          <div className="flex items-center gap-2">{gpsPlaceholder}{registrarMenu}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Esta unidad no tuvo actividad registrada en este periodo. El resumen de flota (mediana y ranking) ya la excluye mientras esté fuera de servicio.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div>
          <p className="text-sm font-semibold">{bucket.label} · {vehicle.plate || `#${vehicle.unit_number}`}</p>
          {driverName && <p className="text-xs text-muted-foreground">Conductor: {driverName}</p>}
        </div>
        <div className="flex items-center gap-2">{gpsPlaceholder}{registrarMenu}</div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div><p className="text-xs text-muted-foreground mb-0.5">Ingreso</p><p className="text-base font-bold font-mono">${Math.round(cell.revenue).toLocaleString()}</p></div>
        <div><p className="text-xs text-muted-foreground mb-0.5">Gastos</p><p className="text-base font-bold font-mono text-destructive">${Math.round(cell.cost).toLocaleString()}</p></div>
        <div><p className="text-xs text-muted-foreground mb-0.5">Utilidad</p><p className="text-base font-bold font-mono text-success">${Math.round(cell.profit).toLocaleString()}</p></div>
      </div>

      <div className="mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Comentarios</h4>
        {allNotes.length === 0
          ? <p className="text-sm text-muted-foreground">Sin comentarios en este periodo.</p>
          : allNotes.map((n) => (
            <div key={n.id} className="py-1.5 border-b border-border last:border-0">
              <p className="text-sm">{n.text}</p>
              {n.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {n.attachments.map((a, i) => (
                    a.file_type?.startsWith('image/') ? (
                      <a key={i} href={a.file_url} target="_blank" rel="noopener noreferrer">
                        <img src={a.file_url} alt={a.file_name} className="w-12 h-12 rounded-md object-cover border border-border" />
                      </a>
                    ) : (
                      <a key={i} href={a.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-secondary rounded-full px-2 py-1">
                        <FileText className="w-3 h-3" />{a.file_name}
                      </a>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        <NoteComposer onSave={addNote} />
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Insights</h4>
        <div className="space-y-1 text-sm">
          {isBest && <p className="text-success">✓ Mejor periodo para esta unidad en el rango seleccionado</p>}
          {vsFleetPct != null && (
            <p className={vsFleetPct >= 0 ? 'text-success' : 'text-warning'}>
              {vsFleetPct >= 0 ? '✓' : '⚠'} {Math.abs(vsFleetPct)}% {vsFleetPct >= 0 ? 'arriba' : 'abajo'} del promedio de flota en este periodo
            </p>
          )}
          {streak >= 3 && <p className="text-success">✓ {streak}° periodo consecutivo igual o por encima de su propio promedio</p>}
          {highCost && <p className="text-warning">⚠ Gasto inusualmente alto — revisa si hubo un mantenimiento no planeado</p>}
        </div>
      </div>
    </div>
  );
}
