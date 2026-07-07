import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageSquarePlus, Plus, DollarSign, Receipt, Wrench, StickyNote, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cellsForVehicle } from '@/lib/fleetMetricsRange';
import { useTenant } from '@/lib/TenantContext';
import { useInvalidateEntity } from '@/hooks/useEntities';
import { useUnitDayNotes } from '@/hooks/useFleetMetrics';
import ExpenseForm from '@/components/financial/ExpenseForm';
import MaintenanceForm from '@/components/maintenance/MaintenanceForm';
import QuickIncomeModal from '@/components/reports/QuickIncomeModal';

/**
 * Detalle de una celda de la matriz día × unidad: ingreso/gasto/utilidad del
 * bucket seleccionado, comentarios (UnitDayNote propios + notas de pago y
 * mantenimiento que cayeron ese día) e insights calculados en cliente a
 * partir de los mismos datos que ya trae fleetUnitMetrics (sin lógica de
 * "insight" en el servidor). También permite registrar en el momento un
 * ingreso, gasto o mantenimiento para esta unidad y este día, reutilizando
 * los formularios ya existentes de Gastos/Mantenimiento.
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
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openForm, setOpenForm] = useState(null); // null | 'expense' | 'maintenance' | 'income'

  const date = bucket.dates[0];
  const singleVehicleList = [{ id: vehicle.vehicle_id, plate: vehicle.plate || `#${vehicle.unit_number}` }];

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
    .map((n) => ({ id: n.id, text: `"${n.text}"` }));
  const maintNotes = (maintenance || [])
    .filter((m) => m.vehicle_id === vehicle.vehicle_id && bucket.dates.includes(String(m.performed_at).slice(0, 10)) && m.description)
    .map((m) => ({ id: m.id, text: `"${m.description}" — nota de mantenimiento` }));
  const paymentNotes = (rentCharges || [])
    .filter((c) => c.vehicle_id === vehicle.vehicle_id)
    .flatMap((c) => (c.payments || []).filter((p) => p.note && bucket.dates.includes(p.paid_at)))
    .map((p, i) => ({ id: `pay-${i}`, text: `"${p.note}" — nota de pago` }));
  const allNotes = [...dateNotes, ...maintNotes, ...paymentNotes];

  const addNote = async () => {
    if (!draft.trim() || !tenantId) return;
    setSaving(true);
    try {
      await base44.entities.UnitDayNote.create({
        tenant_id: tenantId,
        vehicle_id: vehicle.vehicle_id,
        note_date: date,
        text: draft.trim(),
      });
      setDraft('');
      invalidate('UnitDayNote');
    } finally {
      setSaving(false);
    }
  };

  // Refresca tanto las listas de entidades (Gastos/Mantenimiento/Rentas usan
  // las mismas) como la matriz de /reports (fleetUnitMetrics), que no vive
  // bajo la misma queryKey que useEntityList.
  const afterQuickSave = (entityName) => {
    invalidate(entityName);
    qc.invalidateQueries({ queryKey: ['fleetUnitMetrics'] });
    setOpenForm(null);
  };

  const registrarMenu = (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0"><Plus className="w-3.5 h-3.5" />Registrar</Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="end">
        <button onClick={() => { setOpenForm('income'); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-accent text-left">
          <DollarSign className="w-4 h-4 text-success" />Ingreso
        </button>
        <button onClick={() => { setOpenForm('expense'); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-accent text-left">
          <Receipt className="w-4 h-4 text-destructive" />Gasto
        </button>
        <button onClick={() => { setOpenForm('maintenance'); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-accent text-left">
          <Wrench className="w-4 h-4 text-warning" />Mantenimiento
        </button>
        <button onClick={() => { setMenuOpen(false); document.getElementById(`note-input-${vehicle.vehicle_id}`)?.focus(); }} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-accent text-left">
          <StickyNote className="w-4 h-4 text-muted-foreground" />Evento / nota
        </button>
      </PopoverContent>
    </Popover>
  );

  const gpsPlaceholder = (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 rounded-full px-2.5 py-1 cursor-not-allowed"
      title="Ubicación en vivo vía Rainde (proveedor de GPS) — integración pendiente"
    >
      <MapPin className="w-3.5 h-3.5" />GPS (Rainde) · Próximamente
    </span>
  );

  const quickForms = (
    <>
      {openForm === 'expense' && (
        <ExpenseForm
          record={{ vehicle_id: vehicle.vehicle_id, expense_date: date }}
          vehicles={singleVehicleList}
          onClose={() => setOpenForm(null)}
          onSave={async (data) => {
            await base44.entities.Expense.create({ ...data, tenant_id: tenantId });
            afterQuickSave('Expense');
          }}
        />
      )}
      {openForm === 'maintenance' && (
        <MaintenanceForm
          record={{ vehicle_id: vehicle.vehicle_id, performed_at: date }}
          vehicles={singleVehicleList}
          onClose={() => setOpenForm(null)}
          onSave={async (data) => {
            await base44.entities.Maintenance.create({ ...data, tenant_id: tenantId });
            afterQuickSave('Maintenance');
          }}
        />
      )}
      {openForm === 'income' && (
        <QuickIncomeModal
          tenantId={tenantId}
          vehicleId={vehicle.vehicle_id}
          driverId={vehicle.assigned_driver_id}
          date={date}
          onClose={() => setOpenForm(null)}
          onSaved={() => afterQuickSave('RentCharge')}
        />
      )}
    </>
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
        {quickForms}
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
          : allNotes.map((n) => <p key={n.id} className="text-sm py-1.5 border-b border-border last:border-0">{n.text}</p>)}
        <div className="flex gap-2 mt-2">
          <Input id={`note-input-${vehicle.vehicle_id}`} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Agregar nota para esta unidad..." className="h-8 text-sm bg-background" />
          <Button size="sm" variant="outline" onClick={addNote} disabled={saving || !draft.trim()} className="gap-1 shrink-0">
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </Button>
        </div>
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

      {quickForms}
    </div>
  );
}
