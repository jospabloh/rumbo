import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTenant } from '@/lib/TenantContext';
import { getSetting } from '@/lib/settings';
import { statusOf } from '@/components/rentas/rentUtils';
import { guardedUpdate } from '@/lib/guardedWrite';

// Bono por referido: el referidor gana un monto (descontado de su renta) cuando su
// referido cumple N pagos semanales puntuales. Monto y meta son configurables por el
// tenant (Administración → Configuración del negocio); aquí solo se leen con su default.

function weeklyOnTimeCount(charges, driverId) {
  return charges
    .filter(c => c.driver_id === driverId && c.period_type === 'weekly' && (c.amount_due || 0) > 0 && (c.amount_paid || 0) >= (c.amount_due || 0))
    .filter(c => {
      const last = (c.payments || []).reduce((m, p) => (p.paid_at && p.paid_at > m ? p.paid_at : m), '');
      return last && c.period_end && last <= c.period_end;
    }).length;
}

export default function ReferralsView({ drivers, charges, loading, readOnly, onApplied }) {
  const { tenant } = useTenant();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const byId = (id) => drivers.find(d => d.id === id);

  const bonusAmount = getSetting(tenant, 'referral_bonus_amount');
  const onTimeTarget = getSetting(tenant, 'referral_on_time_target');

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
      // Reparte el bono entre los cobros abiertos del MÁS ANTIGUO al más nuevo; lo que no
      // alcance a cubrirse ahora se guarda como crédito del referidor y se descuenta de sus
      // próximos cobros (ver applyReferralCredit en Rentas). Así no se pierde el sobrante.
      const open = charges
        .filter(c => c.driver_id === referrer.id && (c.amount_paid || 0) < (c.amount_due || 0))
        .sort((a, b) => (a.period_start < b.period_start ? -1 : 1));

      let remaining = bonusAmount;
      for (const c of open) {
        if (remaining <= 0) break;
        const balance = (c.amount_due || 0) - (c.amount_paid || 0);
        const applied = Math.min(balance, remaining);
        if (applied <= 0) continue;
        const newDue = (c.amount_due || 0) - applied;
        remaining = Math.round((remaining - applied) * 100) / 100;
        await guardedUpdate('RentCharge', c.id, {
          amount_due: newDue,
          status: statusOf({ amount_due: newDue, amount_paid: c.amount_paid || 0 }),
          notes: `${c.notes ? c.notes + ' · ' : ''}Bono referido (-$${applied.toLocaleString()}) por ${referredDriver.full_name}`,
        });
      }

      // Sobrante → crédito del referidor (se aplicará a sus próximos cobros).
      if (remaining > 0) {
        const prevCredit = Number(referrer.referral_credit) || 0;
        await guardedUpdate('Driver', referrer.id, { referral_credit: Math.round((prevCredit + remaining) * 100) / 100 });
      }

      await guardedUpdate('Driver', referredDriver.id, { referral_bonus_paid: true });
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
        El conductor que refiere gana un bono de ${bonusAmount.toLocaleString()} (descontado de su renta) cuando su referido cumple {onTimeTarget} pagos semanales puntuales.
        {' '}El monto y la meta se configuran en <span className="text-foreground font-medium">Administración → Configuración del negocio</span>.
      </p>
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-10 text-sm">Aún no hay conductores referidos. Asígnalo en el formulario del conductor ("Referido por").</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ referrer, list }) => (
            <div key={referrer.id} className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-semibold mb-2">
                Refiere: {referrer.full_name}
                {Number(referrer.referral_credit) > 0 && (
                  <span className="text-xs text-success font-normal ml-2">· crédito ${Number(referrer.referral_credit).toLocaleString()}</span>
                )}
              </p>
              <div className="space-y-2">
                {list.map(rd => {
                  const onTime = weeklyOnTimeCount(charges, rd.id);
                  const eligible = onTime >= onTimeTarget && !rd.referral_bonus_paid;
                  return (
                    <div key={rd.id} className="flex items-center gap-3 text-sm border-t border-border pt-2 first:border-0 first:pt-0">
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{rd.full_name}</p>
                        <p className="text-xs text-muted-foreground">Pagos puntuales: {Math.min(onTime, onTimeTarget)}/{onTimeTarget}</p>
                      </div>
                      {rd.referral_bonus_paid ? (
                        <span className="text-xs text-success font-medium shrink-0">Bono aplicado ✓</span>
                      ) : eligible && !readOnly ? (
                        <Button size="sm" disabled={busyId === rd.id} onClick={() => applyBonus(referrer, rd)} className="h-8 shrink-0">
                          {busyId === rd.id ? '...' : `Aplicar bono $${bonusAmount.toLocaleString()}`}
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
