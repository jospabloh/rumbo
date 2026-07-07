import { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Banknote, Wrench, Fuel, AlertTriangle } from 'lucide-react';
import { useEntityList } from '@/hooks/useEntities';
import { EmptyState } from '@/components/ui/empty-state';

const KIND_LABEL = { preventive: 'Preventivo', corrective: 'Correctivo', major_repair: 'Arreglo mayor' };
const CATEGORY_LABEL = { general: 'General', engine: 'Motor', brakes: 'Frenos', electrical: 'Eléctrico', tires: 'Llantas', body: 'Carrocería', other: 'Otro' };

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'rentas', label: 'Rentas' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
  { id: 'combustible', label: 'Combustible' },
  { id: 'multas', label: 'Multas' },
];

/**
 * Historial completo de una unidad: tendencia de utilidad (del rango activo en
 * /reports, vehicle.daily) + tablas de RentCharge/Maintenance/FuelLog/Fine vía
 * lectura directa de entidades (no por fleetUnitMetrics, que solo agrega
 * cifras por rango) — misma separación que ya existe entre CostPerKm.jsx
 * (agregado por función) y VehicleDetail.jsx (lecturas directas).
 *
 * @param {{ vehicle: any, driverName?: string, onBack: () => void }} props
 */
export default function UnitDrilldown({ vehicle, driverName, onBack }) {
  const [tab, setTab] = useState('resumen');
  const { data: rentCharges = [] } = useEntityList('RentCharge', { filter: { vehicle_id: vehicle.vehicle_id }, sort: '-period_start' });
  const { data: maintenance = [] } = useEntityList('Maintenance', { filter: { vehicle_id: vehicle.vehicle_id }, sort: '-performed_at' });
  const { data: fuelLogs = [] } = useEntityList('FuelLog', { filter: { vehicle_id: vehicle.vehicle_id }, sort: '-logged_at' });
  const { data: fines = [] } = useEntityList('Fine', { filter: { vehicle_id: vehicle.vehicle_id }, sort: '-issued_at' });

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-bold text-sm">{vehicle.plate || `#${vehicle.unit_number}`}</h2>
          {driverName && <p className="text-xs text-muted-foreground">Conductor: {driverName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          ['Ingreso', `$${Math.round(vehicle.revenue).toLocaleString()}`],
          ['Costo', `$${Math.round(vehicle.cost).toLocaleString()}`],
          ['Utilidad', `$${Math.round(vehicle.profit).toLocaleString()}`],
          ['Km recorridos', vehicle.km_traveled != null ? vehicle.km_traveled.toLocaleString() : '—'],
          ['Costo/km', vehicle.cost_per_km != null ? `$${vehicle.cost_per_km.toFixed(2)}` : '—'],
        ].map(([label, value]) => (
          <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-bold font-mono">{value}</p></div>
        ))}
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-4 overflow-x-auto w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={vehicle.daily || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <Tooltip
                formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Utilidad']}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#profitFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'rentas' && (
        rentCharges.length === 0 ? <EmptyState icon={Banknote} title="Sin cobros de renta" className="py-8" /> : (
          <div className="space-y-1.5">
            {rentCharges.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                <span>{c.period_start}{c.period_end && c.period_end !== c.period_start ? ` → ${c.period_end}` : ''}</span>
                <span className="font-mono">${Number(c.amount_paid || 0).toLocaleString()} / ${Number(c.amount_due || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'mantenimiento' && (
        maintenance.length === 0 ? <EmptyState icon={Wrench} title="Sin mantenimientos" className="py-8" /> : (
          <div className="space-y-1.5">
            {maintenance.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                <div>
                  <p>{m.description || KIND_LABEL[m.kind] || m.kind}</p>
                  <p className="text-xs text-muted-foreground">{m.performed_at} · {KIND_LABEL[m.kind] || m.kind} · {CATEGORY_LABEL[m.category] || m.category || 'General'}</p>
                </div>
                <span className="font-mono">${Number(m.cost || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'combustible' && (
        fuelLogs.length === 0 ? <EmptyState icon={Fuel} title="Sin cargas de combustible" className="py-8" /> : (
          <div className="space-y-1.5">
            {fuelLogs.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                <span>{l.logged_at?.slice(0, 10)} · {l.liters ? `${l.liters} L` : ''} · {l.odometer ? `${l.odometer.toLocaleString()} km` : ''}</span>
                <span className="font-mono">${Number(l.total_cost || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'multas' && (
        fines.length === 0 ? <EmptyState icon={AlertTriangle} title="Sin multas" className="py-8" /> : (
          <div className="space-y-1.5">
            {fines.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                <span>{f.issued_at} · {f.fine_type || 'Multa'}{f.paid ? ' · pagada' : ''}</span>
                <span className="font-mono">${Number(f.amount || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
