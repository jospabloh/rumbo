import { EmptyState } from '@/components/ui/empty-state';
import { TrendingUp } from 'lucide-react';

function Sparkline({ values, projected }) {
  const all = [...values.filter((v) => v != null), projected].filter((v) => v != null);
  const max = Math.max(1, ...all.map(Math.abs));
  return (
    <div className="flex items-end gap-1 h-8 my-2">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-t-sm bg-primary/55" style={{ height: `${Math.max(10, (Math.abs(v || 0) / max) * 100)}%` }} title={v != null ? `$${Math.round(v).toLocaleString()}/día` : 'Sin datos'} />
      ))}
      {projected != null && (
        <div className="flex-1 rounded-t-sm border-2 border-dashed border-muted-foreground" style={{ height: `${Math.max(10, (Math.abs(projected) / max) * 100)}%` }} title={`Proyección: $${Math.round(projected).toLocaleString()}/día`} />
      )}
    </div>
  );
}

function riskPill(vehicle) {
  if (vehicle.below_range) return { label: 'BAJO RANGO', cls: 'bg-destructive/15 text-destructive' };
  if (vehicle.projected_below_range) return { label: 'RIESGO', cls: 'bg-warning/15 text-warning' };
  return { label: 'ESTABLE', cls: 'bg-success/15 text-success' };
}

/**
 * Pronóstico por unidad: tendencia de utilidad/día (regresión lineal simple
 * sobre los periodos anteriores, calculada en el servidor por
 * fleetUnitMetrics — no es IA), riesgo de caer bajo el rango de flota, y
 * estimados de próximo mantenimiento preventivo / cambio de llantas.
 *
 * @param {{ vehicles: any[] }} props  `data.vehicles` de fleetUnitMetrics (con trailingPeriods).
 */
export default function PredictiveAnalytics({ vehicles }) {
  const withForecast = vehicles.filter((v) => v.trailing_profit_per_active_day);
  if (withForecast.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <EmptyState icon={TrendingUp} title="Sin historial suficiente para proyectar" description="Se necesitan al menos 2 periodos anteriores con datos." className="py-6" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {withForecast.map((v) => {
        const risk = riskPill(v);
        const trend = v.projected_next_profit_per_active_day != null && v.trailing_profit_per_active_day[0] != null
          ? Math.round(((v.projected_next_profit_per_active_day - v.trailing_profit_per_active_day[0]) / Math.abs(v.trailing_profit_per_active_day[0])) * 100)
          : null;
        return (
          <div key={v.vehicle_id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">{v.plate || `#${v.unit_number}`}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${risk.cls}`}>{risk.label}</span>
            </div>
            {v.status === 'active' ? (
              <>
                <Sparkline values={v.trailing_profit_per_active_day} projected={v.projected_next_profit_per_active_day} />
                {v.projected_next_profit_per_active_day != null && (
                  <p className="text-xs text-muted-foreground">
                    Proyección próx. periodo: <b className="text-foreground font-mono">${Math.round(v.projected_next_profit_per_active_day).toLocaleString()}</b>/día
                    {trend != null && ` (${trend >= 0 ? '+' : ''}${trend}% tendencia)`}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-2">Sin proyección mientras la unidad esté fuera de servicio.</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              🔧 Próximo preventivo: <b className="text-foreground">{v.next_preventive_estimate?.date || 'sin estimar'}</b>
              {v.next_preventive_estimate?.source === 'km_projection' && ' (por kilometraje)'}
            </p>
            <p className="text-xs text-muted-foreground">
              🛞 Próx. cambio de llantas: <b className="text-foreground">
                {v.next_tire_estimate?.km_remaining != null ? `~${Math.round(v.next_tire_estimate.km_remaining).toLocaleString()} km` : 'sin estimar'}
              </b>
              {v.next_tire_estimate?.date && ` (${v.next_tire_estimate.date})`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
