import { useState } from 'react';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

// Reporte de ingresos: por día (quién pagó) y por semana (total + adeudos)
export default function IngresosView({ charges, vehicleById, driverById, debtors, loading }) {
  const [mode, setMode] = useState('day');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const allPayments = [];
  for (const c of charges) {
    for (const p of (c.payments || [])) {
      allPayments.push({ ...p, driver_id: c.driver_id, vehicle_id: c.vehicle_id });
    }
  }

  const base = parseISO(date);
  const weekStart = format(startOfWeek(base, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(base, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const inRange = (at) => mode === 'day' ? at === date : (at >= weekStart && at <= weekEnd);

  const payments = allPayments.filter(p => p.paid_at && inRange(p.paid_at));
  const total = payments.reduce((s, p) => s + (p.amount || 0), 0);

  const byDriver = {};
  for (const p of payments) byDriver[p.driver_id] = (byDriver[p.driver_id] || 0) + (p.amount || 0);
  const driverRows = Object.entries(byDriver)
    .map(([id, amt]) => ({ driver: driverById(id), amt }))
    .filter(x => x.driver).sort((a, b) => b.amt - a.amt);

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {[['day', 'Día'], ['week', 'Semana']].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${mode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{label}</button>
          ))}
        </div>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-card border-border h-9 w-auto" />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4 text-center">
        <p className="text-2xl font-bold text-success">${total.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{mode === 'day' ? `Cobrado el ${date}` : `Cobrado ${weekStart} → ${weekEnd}`} · {payments.length} pago(s)</p>
      </div>

      {mode === 'day' ? (
        <div className="space-y-2">
          {payments.map((p, i) => {
            const v = vehicleById(p.vehicle_id);
            const d = driverById(p.driver_id);
            return (
              <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{d?.full_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{v?.plate || (v?.unit_number ? `#${v.unit_number}` : 'Unidad')} · {p.method || 'pago'}{p.note ? ` · ${p.note}` : ''}</p>
                </div>
                <p className="text-sm font-bold text-success">${Number(p.amount || 0).toLocaleString()}</p>
              </div>
            );
          })}
          {payments.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Sin pagos ese día.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">Ingreso por conductor</h3>
            <div className="space-y-1.5">
              {driverRows.map(({ driver, amt }) => (
                <div key={driver.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{driver.full_name}</span>
                  <span className="font-bold text-success shrink-0">${amt.toLocaleString()}</span>
                </div>
              ))}
              {driverRows.length === 0 && <p className="text-sm text-muted-foreground">Sin pagos esta semana.</p>}
            </div>
          </div>
          {debtors.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-destructive" />Quedaron debiendo</h3>
              <div className="space-y-1.5">
                {debtors.map(({ driver, bal }) => (
                  <div key={driver.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{driver.full_name}</span>
                    <span className="font-bold text-destructive shrink-0">${bal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
