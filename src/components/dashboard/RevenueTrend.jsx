import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { revenueSeries } from '@/lib/dashboard';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Tendencia de ingresos cobrados de los últimos 7 días.
 *
 * Es el elemento "premium" del dashboard: un área limpia con cifras tabulares
 * que da contexto de la operación de un vistazo. Usa colores semánticos del
 * tema (hereda el branding del tenant) en vez de paletas fijas.
 *
 * @param {{ charges: any[] }} props
 */
export default function RevenueTrend({ charges }) {
  const data = useMemo(() => revenueSeries(charges), [charges]);
  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">Ingresos · últimos 7 días</h2>
        <span className="text-sm font-bold font-mono text-success">${total.toLocaleString()}</span>
      </div>
      {total === 0 ? (
        <EmptyState icon={TrendingUp} title="Sin cobros recientes" description="Los ingresos de las rentas aparecerán aquí." className="py-8" />
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <Tooltip
                formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Cobrado']}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--popover-foreground))' }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                cursor={{ stroke: 'hsl(var(--border))' }}
              />
              <Area type="monotone" dataKey="total" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
