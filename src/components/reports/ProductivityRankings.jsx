function RankRow({ position, label, sub, value, max, tone }) {
  const pct = max > 0 ? Math.max(4, Math.round((Math.abs(value) / max) * 100)) : 0;
  const barColor = tone === 'best' ? 'hsl(var(--success))' : tone === 'worst' ? 'hsl(var(--critical))' : 'hsl(var(--primary))';
  return (
    <li className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <span className="w-5 text-xs font-bold text-muted-foreground shrink-0">{position}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {label}
          {tone === 'best' && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success/15 text-success align-middle">TOP</span>}
          {tone === 'worst' && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive align-middle">BAJO RANGO</span>}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden shrink-0">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <span className="w-20 text-right text-sm font-bold font-mono shrink-0">${Math.round(value).toLocaleString()}</span>
    </li>
  );
}

/**
 * Ranking de unidades y de conductores por utilidad/ingreso por día activo —
 * top 3 y bottom 3 (marcando quiénes están bajo el rango de la flota).
 *
 * @param {{ title: string, sub: string, rows: {id:string,label:string,sub?:string,value:number,belowRange?:boolean}[] }} props
 */
export default function ProductivityRankings({ title, sub, rows }) {
  const eligible = rows.filter((r) => r.value != null);
  const sorted = [...eligible].sort((a, b) => b.value - a.value);
  const max = sorted.length ? Math.max(...sorted.map((r) => Math.abs(r.value))) : 0;
  const top = sorted.slice(0, 3);
  const bottom = sorted.slice(-3).reverse().filter((r) => !top.includes(r));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Sin datos suficientes en este rango.</p>
      ) : (
        <ul>
          {top.map((r) => <RankRow key={r.id} position={sorted.indexOf(r) + 1} label={r.label} sub={r.sub} value={r.value} max={max} tone={r === top[0] ? 'best' : undefined} />)}
          {sorted.length > top.length + bottom.length && (
            <li className="text-xs text-muted-foreground py-1.5 text-center">{sorted.length - top.length - bottom.length} más</li>
          )}
          {bottom.map((r) => <RankRow key={r.id} position={sorted.indexOf(r) + 1} label={r.label} sub={r.sub} value={r.value} max={max} tone={r.belowRange ? 'worst' : undefined} />)}
        </ul>
      )}
    </div>
  );
}
