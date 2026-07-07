import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Banknote, Plus, Search, Check, AlertCircle, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { FormError } from '@/components/ui/form-error';
import { useTenant } from '@/lib/TenantContext';
import { useCatalog } from '@/lib/catalogs';
import { useRentCharges, useVehicles, useDrivers, useInvalidateEntity } from '@/hooks/useEntities';
import { todayStr, currentPeriod, statusOf, isOverdue, periodsOverlap, statusMeta } from '@/components/rentas/rentUtils';
import { getSetting } from '@/lib/settings';
import ManualChargeModal from '@/components/rentas/ManualChargeModal';
import IngresosView from '@/components/rentas/IngresosView';
import ReferralsView from '@/components/rentas/ReferralsView';

export default function Rentas() {
  const { tenant, tenantId, readOnly } = useTenant();
  const graceDays = getSetting(tenant, 'rent_grace_days');
  const paymentMethods = useCatalog('payment_method');
  const { data: charges = [], isLoading: loading } = useRentCharges({ sort: '-period_start', limit: 300 });
  const { data: vehicles = [] } = useVehicles();
  const { data: drivers = [] } = useDrivers();
  const invalidate = useInvalidateEntity();
  const refresh = () => invalidate('RentCharge');

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [banner, setBanner] = useState('');

  // Modal de pago
  const [payCharge, setPayCharge] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', method: 'efectivo', note: '' });
  const [payError, setPayError] = useState('');
  const [paySaving, setPaySaving] = useState(false);

  // Modal de cargo manual
  const [showCharge, setShowCharge] = useState(false);

  // Vista: cobros (ledger) o ingresos (reporte de pagos)
  const [view, setView] = useState('cobros');

  const vehicleById = (id) => vehicles.find(v => v.id === id);
  const driverById = (id) => drivers.find(d => d.id === id);

  // KPIs
  const totalDue = charges.reduce((s, c) => s + Math.max((c.amount_due || 0) - (c.amount_paid || 0), 0), 0);
  const collectedToday = charges.reduce((s, c) =>
    s + (c.payments || []).filter(p => p.paid_at === todayStr()).reduce((a, p) => a + (p.amount || 0), 0), 0);

  // Saldo por conductor (lo que debe)
  const balanceByDriver = {};
  for (const c of charges) {
    const bal = (c.amount_due || 0) - (c.amount_paid || 0);
    if (bal <= 0) continue;
    balanceByDriver[c.driver_id] = (balanceByDriver[c.driver_id] || 0) + bal;
  }
  const debtors = Object.entries(balanceByDriver)
    .map(([id, bal]) => ({ driver: driverById(id), bal }))
    .filter(x => x.driver)
    .sort((a, b) => b.bal - a.bal);

  const filtered = charges.filter(c => {
    const st = isOverdue(c, graceDays) ? 'overdue' : statusOf(c);
    if (statusFilter !== 'all' && st !== statusFilter) return false;
    if (!search) return true;
    const v = vehicleById(c.vehicle_id);
    const d = driverById(c.driver_id);
    const hay = `${v?.plate || ''} ${v?.unit_number || ''} ${d?.full_name || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const generatePeriodCharges = async () => {
    if (!tenantId) { setBanner('Tu organización aún se está configurando.'); return; }
    setGenerating(true);
    setBanner('');
    try {
      let created = 0, skipped = 0, credited = 0, carried = 0;
      // Créditos de bono de referido pendientes por conductor (se consumen al generar sus cobros).
      const creditLeft = {};
      for (const d of drivers) creditLeft[d.id] = Number(d.referral_credit) || 0;

      for (const v of vehicles) {
        if (v.status !== 'active') continue;
        if (!v.rent_amount || !v.assigned_driver_id) continue;
        const freq = v.rent_frequency || 'weekly';
        const { period_start, period_end } = currentPeriod(freq, v.rent_day);
        // Dedup por SOLAPAMIENTO de periodo (no solo period_start exacto): evita cobros
        // duplicados de la misma semana cuando cambia el día de cobro (rent_day).
        const exists = charges.some(c => c.vehicle_id === v.id && periodsOverlap(c.period_start, c.period_end, period_start, period_end));
        if (exists) { skipped++; continue; }

        // Saldo pendiente de cobros anteriores de ESTA unidad: se traslada a la renta
        // de esta semana en vez de quedar como un cobro vencido aparte (que además
        // seguiría sumándose semana tras semana sin que nadie lo note).
        const priorOpen = charges.filter(c => c.vehicle_id === v.id && ((c.amount_due || 0) - (c.amount_paid || 0)) > 0);
        const priorBalance = Math.round(priorOpen.reduce((s, c) => s + ((c.amount_due || 0) - (c.amount_paid || 0)), 0) * 100) / 100;

        let amount_due = Math.round((Number(v.rent_amount) + priorBalance) * 100) / 100;
        const driverId = v.assigned_driver_id;
        let note = priorBalance > 0 ? `Incluye $${priorBalance.toLocaleString()} de saldo anterior` : '';
        const credit = creditLeft[driverId] || 0;
        if (credit > 0) {
          const applied = Math.min(credit, amount_due);
          amount_due = Math.round((amount_due - applied) * 100) / 100;
          creditLeft[driverId] = Math.round((credit - applied) * 100) / 100;
          note = [note, `Crédito de bono aplicado (-$${applied.toLocaleString()})`].filter(Boolean).join(' · ');
          credited++;
        }

        await base44.entities.RentCharge.create({
          tenant_id: tenantId,
          vehicle_id: v.id,
          driver_id: driverId,
          period_type: freq,
          period_start,
          period_end,
          amount_due,
          amount_paid: 0,
          status: statusOf({ amount_due, amount_paid: 0 }),
          payments: [],
          notes: note,
          carried_over_amount: priorBalance,
        });
        created++;

        if (priorBalance > 0) {
          carried++;
          // Cierra el saldo de los cobros anteriores: ya quedó incluido en el nuevo.
          // Se reduce su amount_due a lo ya pagado (balance queda en 0, status pasa a
          // 'paid' de forma natural) en vez de dejarlo como deuda duplicada.
          for (const c of priorOpen) {
            await base44.entities.RentCharge.update(c.id, {
              amount_due: c.amount_paid || 0,
              carried_forward: true,
              notes: [c.notes, 'Saldo trasladado a la semana siguiente'].filter(Boolean).join(' · '),
            }).catch(() => {});
          }
          // Alerta al admin: resuelve la anterior de esta unidad (si sigue abierta) y
          // crea una nueva con el monto actualizado — no se van acumulando alertas viejas.
          try {
            const openAlerts = await base44.entities.Alert.filter({ tenant_id: tenantId, entity_type: 'rent_balance', entity_id: v.id, resolved: false });
            for (const a of openAlerts) await base44.entities.Alert.update(a.id, { resolved: true }).catch(() => {});
            await base44.entities.Alert.create({
              tenant_id: tenantId,
              entity_type: 'rent_balance',
              entity_id: v.id,
              vehicle_id: v.id,
              driver_id: driverId,
              message: `${v.plate || 'Unidad'} arrastra $${priorBalance.toLocaleString()} de la semana anterior`,
              severity: 'warning',
              due_date: period_end,
              resolved: false,
            });
          } catch (_e) { /* no bloquea la generación de cobros si falla la alerta */ }
        }
      }

      // Persiste el crédito restante por conductor (lo que no se consumió esta vez).
      for (const d of drivers) {
        const left = creditLeft[d.id] || 0;
        if (left !== (Number(d.referral_credit) || 0)) {
          await base44.entities.Driver.update(d.id, { referral_credit: left }).catch(() => {});
        }
      }

      setBanner(`${created} cobro(s) generado(s)${skipped ? `, ${skipped} ya existían` : ''}${credited ? `, ${credited} con crédito de referido` : ''}${carried ? `, ${carried} con saldo trasladado` : ''}.`);
      refresh();
      if (credited || carried) invalidate('Driver', 'Alert');
    } catch (e) {
      setBanner('No se pudieron generar los cobros. Inténtalo de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const openPay = (c) => {
    setPayCharge(c);
    setPayForm({ amount: String(Math.max((c.amount_due || 0) - (c.amount_paid || 0), 0)), method: paymentMethods[0] || 'Efectivo', note: '' });
    setPayError('');
  };

  const submitPayment = async () => {
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { setPayError('Ingresa un monto válido.'); return; }
    setPaySaving(true);
    setPayError('');
    try {
      const c = payCharge;
      const payments = [...(c.payments || []), { amount, paid_at: todayStr(), method: payForm.method, note: payForm.note.trim() }];
      const amount_paid = Math.round(payments.reduce((a, p) => a + (p.amount || 0), 0) * 100) / 100;
      const status = statusOf({ amount_due: c.amount_due, amount_paid });
      await base44.entities.RentCharge.update(c.id, { payments, amount_paid, status });
      setPayCharge(null);
      refresh();
    } catch (e) {
      setPayError('No se pudo registrar el pago. Inténtalo de nuevo.');
    } finally {
      setPaySaving(false);
    }
  };

  const filterTabs = [
    { id: 'all', label: 'Todos' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'partial', label: 'Parciales' },
    { id: 'overdue', label: 'Vencidos' },
    { id: 'paid', label: 'Pagados' },
  ];

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Rentas</h1>
          <p className="text-sm text-muted-foreground">Cobros por unidad · quién pagó y quién debe</p>
        </div>
        {view === 'cobros' && !readOnly && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowCharge(true)} className="gap-2"><Plus className="w-4 h-4" />Cobro manual</Button>
            <Button size="sm" onClick={generatePeriodCharges} disabled={generating} className="gap-2">
              <CalendarPlus className="w-4 h-4" />{generating ? 'Generando...' : 'Generar cobros del periodo'}
            </Button>
          </div>
        )}
      </div>

      {/* Cambio de vista */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-4 w-full max-w-xs">
        {[['cobros', 'Cobros'], ['ingresos', 'Ingresos'], ['referidos', 'Referidos']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'ingresos' ? (
        <IngresosView charges={charges} vehicleById={vehicleById} driverById={driverById} debtors={debtors} loading={loading} />
      ) : view === 'referidos' ? (
        <ReferralsView drivers={drivers} charges={charges} loading={loading} readOnly={readOnly} onApplied={() => invalidate('RentCharge', 'Driver')} />
      ) : (
      <>
      {banner && <p className="text-sm bg-primary/10 text-primary rounded-lg px-3 py-2 mb-4">{banner}</p>}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold font-mono tracking-tight text-success">${collectedToday.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Cobrado hoy</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold font-mono tracking-tight text-destructive">${totalDue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Por cobrar</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold font-mono tracking-tight">{debtors.length}</p>
          <p className="text-xs text-muted-foreground">Choferes con adeudo</p>
        </div>
      </div>

      {/* Saldo por conductor */}
      {debtors.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-destructive" />Saldo pendiente por conductor</h2>
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

      {/* Filtros */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por unidad o conductor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
      </div>
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-4 overflow-x-auto">
        {filterTabs.map(t => (
          <button key={t.id} onClick={() => setStatusFilter(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${statusFilter === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista de cobros */}
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const v = vehicleById(c.vehicle_id);
            const d = driverById(c.driver_id);
            const st = isOverdue(c, graceDays) ? 'overdue' : statusOf(c);
            const remaining = Math.max((c.amount_due || 0) - (c.amount_paid || 0), 0);
            const meta = statusMeta[st];
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Banknote className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate font-mono tracking-tight">{v?.plate || 'Unidad'}{v?.unit_number ? ` · #${v.unit_number}` : ''}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{d?.full_name || '—'} · {c.period_type === 'daily' ? 'Día' : 'Semana'} {c.period_start}{c.period_end && c.period_end !== c.period_start ? ` → ${c.period_end}` : ''}</p>
                  <p className="text-xs text-muted-foreground">Pagado ${Number(c.amount_paid || 0).toLocaleString()} de ${Number(c.amount_due || 0).toLocaleString()}{remaining > 0 ? ` · debe $${remaining.toLocaleString()}` : ''}</p>
                </div>
                {st !== 'paid' && !readOnly && (
                  <Button size="sm" variant="outline" onClick={() => openPay(c)} className="gap-1 shrink-0"><Check className="w-3.5 h-3.5" />Pago</Button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Sin cobros. Usa "Generar cobros del periodo" para crear los de esta semana.</p>}
        </div>
      )}
      </>
      )}

      {/* Modal registrar pago */}
      {payCharge && (
        <ResponsiveModal title="Registrar pago" onClose={() => setPayCharge(null)} maxWidth="sm">
            <p className="text-xs text-muted-foreground mb-3">
              {vehicleById(payCharge.vehicle_id)?.plate} · {driverById(payCharge.driver_id)?.full_name} · debe ${Math.max((payCharge.amount_due || 0) - (payCharge.amount_paid || 0), 0).toLocaleString()}
            </p>
            <div className="space-y-3">
              <div>
                <Label>Monto recibido ($)</Label>
                <Input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} className="mt-1 bg-background" autoFocus />
              </div>
              <div>
                <Label>Método</Label>
                <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nota (opcional)</Label>
                <Input value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} className="mt-1 bg-background" placeholder="Ej. abono, imprevisto..." />
              </div>
              <FormError>{payError}</FormError>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setPayCharge(null)} className="flex-1">Cancelar</Button>
                <Button onClick={submitPayment} disabled={paySaving} className="flex-1">{paySaving ? 'Guardando...' : 'Registrar'}</Button>
              </div>
            </div>
        </ResponsiveModal>
      )}

      {/* Modal cobro manual */}
      {showCharge && (
        <ManualChargeModal
          vehicles={vehicles}
          tenantId={tenantId}
          onClose={() => setShowCharge(false)}
          onSaved={() => { setShowCharge(false); refresh(); }}
        />
      )}
    </div>
  );
}
