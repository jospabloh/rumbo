import { useMemo, useState } from 'react';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KINDS, KIND_LABELS, maintenanceTimeline, maintenanceByCategory } from '@/lib/maintenanceStats';

// Mismos colores que los iconos de tipo en la lista de MaintenancePage.
const KIND_COLORS = {
  preventive: 'hsl(var(--primary))',
  corrective: 'hsl(var(--warning))',
  major_repair: 'hsl(var(--destructive))',
};

const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const money = (v) => `$${Number(v).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

function Panel({ children }) {
  return <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2 text-xs shadow-sm space-y-0.5">{children}</div>;
}

/** @param {{ active?: boolean, payload?: any[], label?: string }} props */
function TimelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <Panel>
      <p className="font-semibold">{label}</p>
      {b.total === 0 ? <p className="text-muted-foreground">Sin servicios</p> : (
        <>
          {KINDS.filter((k) => b[k] > 0).map((k) => (
            <p key={k} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: KIND_COLORS[k] }} />
              {KIND_LABELS[k]}: <span className="font-mono">{b[k]}</span>
            </p>
          ))}
          <p className="pt-1">Gasto: <span className="font-mono font-semibold">{money(b.cost)}</span></p>
          {b.withoutCost > 0 && <p className="text-muted-foreground">{b.withoutCost} sin costo capturado</p>}
        </>
      )}
    </Panel>
  );
}

/** @param {{ active?: boolean, payload?: any[] }} props */
function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <Panel>
      <p className="font-semibold">{r.label}</p>
      <p>{r.count} {r.count === 1 ? 'servicio' : 'servicios'}</p>
      <p>Gasto: <span className="font-mono font-semibold">{money(r.cost)}</span></p>
    </Panel>
  );
}

/**
 * Línea de tiempo y desglose de los mantenimientos que la lista está mostrando
 * (sigue la búsqueda: buscar una placa o número de unidad da la gráfica de esa
 * unidad).
 *
 * @param {{ records: any[] }} props
 */
export default function MaintenanceCharts({ records }) {
  const [granularity, setGranularity] = useState(/** @type {'week'|'month'} */ ('month'));
  const timeline = useMemo(() => maintenanceTimeline(records, granularity), [records, granularity]);
  const categories = useMemo(() => maintenanceByCategory(records), [records]);

  const inRange = timeline.reduce((s, b) => s + b.total, 0);
  const cost = timeline.reduce((s, b) => s + b.cost, 0);
  const withoutCost = timeline.reduce((s, b) => s + b.withoutCost, 0);

  if (records.length === 0) return null;

  return (
    <div className="grid gap-3 lg:grid-cols-3 mb-4">
      <section className="bg-card border border-border rounded-xl p-4 lg:col-span-2" aria-label="Línea de tiempo de mantenimientos">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 className="font-semibold text-sm">Servicios por {granularity === 'week' ? 'semana' : 'mes'}</h2>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5" role="group" aria-label="Agrupar por">
            {/** @type {Array<['week'|'month', string]>} */ ([['week', 'Semanas'], ['month', 'Meses']]).map(([g, l]) => (
              <button key={g} type="button" onClick={() => setGranularity(g)} aria-pressed={granularity === g}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${granularity === g ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Últimos 12 · {inRange} {inRange === 1 ? 'servicio' : 'servicios'} · <span className="font-mono text-foreground">{money(cost)}</span>
          {withoutCost > 0 && ` · ${withoutCost} sin costo`}
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={AXIS_TICK} />
              <Tooltip content={<TimelineTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
              {KINDS.map((k, i) => (
                <Bar key={k} dataKey={k} stackId="kind" fill={KIND_COLORS[k]} stroke="hsl(var(--card))" strokeWidth={2}
                  radius={i === KINDS.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={32} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          {KINDS.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: KIND_COLORS[k] }} />{KIND_LABELS[k]}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-card border border-border rounded-xl p-4" aria-label="Mantenimientos por categoría">
        <h2 className="font-semibold text-sm mb-1">Por categoría</h2>
        <p className="text-xs text-muted-foreground mb-3">Todos los registros mostrados</p>
        <div style={{ height: Math.max(120, categories.length * 30) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={128} tick={AXIS_TICK} />
              <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
