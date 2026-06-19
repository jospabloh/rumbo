import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// Bono por referido: el referidor gana $1,000 (descontado de su renta) cuando su
// referido cumple 4 pagos semanales puntuales (pagados a más tardar el día de cobro).
const BONUS_AMOUNT = 1000;
const ON_TIME_TARGET = 4;

function weeklyOnTimeCount(charges, driverId) {
  return charges
    .filter(c => c.driver_id === driverId && c.period_type === 'weekly' && (c.amount_due || 0) > 0 && (c.amount_paid || 0) >= (c.amount_due || 0))
    .filter(c => {
      const last = (c.payments || []).reduce((m, p) => (p.paid_at && p.paid_at > m ? p.paid_at : m), '');
      return last && c.period_end && last <= c.period_end;
    }).length;
}

export default function ReferralsView({ drivers, charges, loading, readOnly, onApplied }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const byId = (id) => drivers.find(d => d.id === id);

  const referred = drivers.filter(d => d.referred_by_driver_id);
  const groups = {};
  for (const d of referred) {
    (groups[d.referred_by_driver_id] = groups[d.referred_by_driver_id] || []).push(d);
  }
  const rows = Object.entries(groups)
    .map(([refId, list]) => ({ referrer: byId(refId), list }))
    .filter(r => r.referrer);

  const applyBonus = async (referrer, referredDriver) => {
    setBusyId(referredDriver.id);
    setError('');
    try {
      const open = charges
        .filter(c => c.driver_id === referrer.id && (c.amount_paid || 0) < (c.amount_due || 0))
        .sort((a, b) => (a.period_start < b.period_start ? 1 : -1))[0];
      if (!open) {
        setError(`${referrer.full_name} no tiene un cobro abierto para aplicar el bono. Genera su cobro primero.`);
        setBusyId(null);
        return;
      }
      const newDue = Math.max(0, (open.amount_due || 0) - BONUS_AMOUNT);
      const paid = open.amount_paid || 0;
      const status = newDue === 0 || paid >= newDue ? 'paid' : paid > 0 ? 'partial' : 'pending';
      await base44.entities.RentCharge.update(open.id, {
        amount_due: newDue,
        status,
        notes: `${open.notes ? open.notes + ' · ' : ''}Bono referido (-$${BONUS_AMOUNT}) por ${referredDriver.full_name}`,
      });
      await base44.entities.Driver.update(referredDriver.id, { referral_bonus_paid: true });
      onApplied();
    } catch (e) {
      setError('No se pudo aplicar el bono.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        El conductor que refiere gana un bono de ${BONUS_AMOUNT.toLocaleString()} (descontado de su renta) cuando su referido cumple {ON_TIME_TARGET} pagos semanales puntuales.
      </p>
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-10 text-sm">Aún no hay conductores referidos. Asígnalo en el formulario del conductor ("Referido por").</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ referrer, list }) => (
            <div key={referrer.id} className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-semibold mb-2">Refiere: {referrer.full_name}</p>
              <div className="space-y-2">
                {list.map(rd => {
                  const onTime = weeklyOnTimeCount(charges, rd.id);
                  const eligible = onTime >= ON_TIME_TARGET && !rd.referral_bonus_paid;
                  return (
                    <div key={rd.id} className="flex items-center gap-3 text-sm border-t border-border pt-2 first:border-0 first:pt-0">
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{rd.full_name}</p>
                        <p className="text-xs text-muted-foreground">Pagos puntuales: {Math.min(onTime, ON_TIME_TARGET)}/{ON_TIME_TARGET}</p>
                      </div>
                      {rd.referral_bonus_paid ? (
                        <span className="text-xs text-success font-medium shrink-0">Bono aplicado ✓</span>
                      ) : eligible && !readOnly ? (
                        <Button size="sm" disabled={busyId === rd.id} onClick={() => applyBonus(referrer, rd)} className="h-8 shrink-0">
                          {busyId === rd.id ? '...' : `Aplicar bono $${BONUS_AMOUNT.toLocaleString()}`}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">{eligible ? 'Listo' : 'En progreso'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
