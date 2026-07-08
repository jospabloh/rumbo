import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/ui/empty-state';
import { Gauge } from 'lucide-react';

/**
 * Costo por km por unidad, un solo eje (nunca dual-eje) — barra roja si la
 * unidad está notablemente sobre el promedio de flota (>15%), verde si está
 * notablemente por debajo (<15%), azul primario (neutro) si está cerca del
 * promedio.
 *
 * @param {{ vehicles: any[] }} props  `data.vehicles` de fleetUnitMetrics.
 */
export default function CostPerKmComparison({ vehicles }) {
  const rows = useMemo(() => vehicles
    .filter((v) => v.cost_per_km != null)
    .map((v) => ({ plate: v.plate || `#${v.unit_number}`, cost_per_km: v.cost_per_km }))
    .sort((a, b) => b.cost_per_km - a.cost_per_km), [vehicles]);

  const avg = rows.length ? rows.reduce((s, r) => s + r.cost_per_km, 0) / rows.length : 0;

  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-2">Costo por km</h3>
        <EmptyState icon={Gauge} title="Sin kilometraje suficiente" description="Se necesitan al menos 2 registros de combustible por unidad en el rango." className="py-6" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-semibold text-sm">Costo por km</h3>
        <span className="text-xs text-muted-foreground">Promedio de flota: <b className="font-mono text-foreground">${avg.toFixed(2)}</b></span>
      </div>
      <div style={{ height: Math.max(160, rows.length * 32) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="plate" width={64} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <ReferenceLine x={avg} stroke="hsl(var(--critical))" strokeDasharray="3 3" />
            <Tooltip
              formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Costo/km']}
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: 'hsl(var(--accent))' }}
            />
            <Bar dataKey="cost_per_km" radius={[0, 4, 4, 0]}>
              {rows.map((r) => (
                <Cell key={r.plate} fill={r.cost_per_km > avg * 1.15 ? 'hsl(var(--critical))' : r.cost_per_km < avg * 0.85 ? 'hsl(var(--success))' : 'hsl(var(--primary))'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
