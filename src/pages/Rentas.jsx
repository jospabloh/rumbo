import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Banknote, Plus, Search, Check, X, AlertCircle, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/lib/TenantContext';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

// Periodo actual (lunes–domingo para semanal, hoy para diaria)
function currentPeriod(freq) {
  const now = new Date();
  if (freq === 'daily') {
    const d = format(now, 'yyyy-MM-dd');
    return { period_start: d, period_end: d };
  }
  return {
    period_start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    period_end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  };
}

function statusOf(c) {
  const due = c.amount_due || 0;
  const paid = c.amount_paid || 0;
  if (paid >= due && due > 0) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}
const isOverdue = (c) => statusOf(c) !== 'paid' && c.period_end && c.period_end < todayStr();

const statusMeta = {
  paid: { label: 'Pagado', cls: 'bg-success/10 text-success' },
  partial: { label: 'Parcial', cls: 'bg-warning/10 text-warning' },
  pending: { label: 'Pendiente', cls: 'bg-muted text-muted-foreground' },
  overdue: { label: 'Vencido', cls: 'bg-destructive/10 text-destructive' },
};

export default function Rentas() {
  const { tenantId } = useTenant();
  const [charges, setCharges] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const load = () => {
    const q = tenantId ? { tenant_id: tenantId } : {};
    Promise.all([
      base44.entities.RentCharge.filter(q, '-period_start', 300),
      base44.entities.Vehicle.filter(q),
      base44.entities.Driver.filter(q),
    ]).then(([c, v, d]) => { setCharges(c); setVehicles(v); setDrivers(d); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [tenantId]);

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
    const st = isOverdue(c) ? 'overdue' : statusOf(c);
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
      let created = 0, skipped = 0;
      for (const v of vehicles) {
        if (v.status !== 'active') continue;
        if (!v.rent_amount || !v.assigned_driver_id) continue;
        const freq = v.rent_frequency || 'weekly';
        const { period_start, period_end } = currentPeriod(freq);
        const exists = charges.some(c => c.vehicle_id === v.id && c.period_start === period_start);
        if (exists) { skipped++; continue; }
        await base44.entities.RentCharge.create({
          tenant_id: tenantId,
          vehicle_id: v.id,
          driver_id: v.assigned_driver_id,
          period_type: freq,
          period_start,
          period_end,
          amount_due: Number(v.rent_amount),
          amount_paid: 0,
          status: 'pending',
          payments: [],
        });
        created++;
      }
      setBanner(`${created} cobro(s) generado(s)${skipped ? `, ${skipped} ya existían` : ''}.`);
      load();
    } catch (e) {
      setBanner('No se pudieron generar los cobros. Inténtalo de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const openPay = (c) => {
    setPayCharge(c);
    setPayForm({ amount: String(Math.max((c.amount_due || 0) - (c.amount_paid || 0), 0)), method: 'efectivo', note: '' });
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
      const amount_paid = payments.reduce((a, p) => a + (p.amount || 0), 0);
      const status = amount_paid >= (c.amount_due || 0) ? 'paid' : 'partial';
      await base44.entities.RentCharge.update(c.id, { payments, amount_paid, status });
      setPayCharge(null);
      load();
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCharge(true)} className="gap-2"><Plus className="w-4 h-4" />Cobro manual</Button>
          <Button size="sm" onClick={generatePeriodCharges} disabled={generating} className="gap-2">
            <CalendarPlus className="w-4 h-4" />{generating ? 'Generando...' : 'Generar cobros del periodo'}
          </Button>
        </div>
      </div>

      {banner && <p className="text-sm bg-primary/10 text-primary rounded-lg px-3 py-2 mb-4">{banner}</p>}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-success">${collectedToday.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Cobrado hoy</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-destructive">${totalDue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Por cobrar</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold">{debtors.length}</p>
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
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const v = vehicleById(c.vehicle_id);
            const d = driverById(c.driver_id);
            const st = isOverdue(c) ? 'overdue' : statusOf(c);
            const remaining = Math.max((c.amount_due || 0) - (c.amount_paid || 0), 0);
            const meta = statusMeta[st];
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Banknote className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{v?.plate || 'Unidad'}{v?.unit_number ? ` · #${v.unit_number}` : ''}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{d?.full_name || '—'} · {c.period_type === 'daily' ? 'Día' : 'Semana'} {c.period_start}{c.period_end && c.period_end !== c.period_start ? ` → ${c.period_end}` : ''}</p>
                  <p className="text-xs text-muted-foreground">Pagado ${Number(c.amount_paid || 0).toLocaleString()} de ${Number(c.amount_due || 0).toLocaleString()}{remaining > 0 ? ` · debe $${remaining.toLocaleString()}` : ''}</p>
                </div>
                {st !== 'paid' && (
                  <Button size="sm" variant="outline" onClick={() => openPay(c)} className="gap-1 shrink-0"><Check className="w-3.5 h-3.5" />Pago</Button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Sin cobros. Usa "Generar cobros del periodo" para crear los de esta semana.</p>}
        </div>
      )}

      {/* Modal registrar pago */}
      {payCharge && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPayCharge(null)} />
          <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Registrar pago</h3>
              <button onClick={() => setPayCharge(null)} className="text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
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
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="deposito">Depósito</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nota (opcional)</Label>
                <Input value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} className="mt-1 bg-background" placeholder="Ej. abono, imprevisto..." />
              </div>
              {payError && <p className="text-sm text-destructive">{payError}</p>}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setPayCharge(null)} className="flex-1">Cancelar</Button>
                <Button onClick={submitPayment} disabled={paySaving} className="flex-1">{paySaving ? 'Guardando...' : 'Registrar'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal cobro manual */}
      {showCharge && (
        <ManualChargeModal
          vehicles={vehicles}
          tenantId={tenantId}
          onClose={() => setShowCharge(false)}
          onSaved={() => { setShowCharge(false); load(); }}
        />
      )}
    </div>
  );
}

function ManualChargeModal({ vehicles, tenantId, onClose, onSaved }) {
  const { period_start, period_end } = currentPeriod('weekly');
  const [form, setForm] = useState({ vehicle_id: '', period_type: 'weekly', period_start, period_end, amount_due: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onVehicle = (id) => {
    const v = vehicles.find(x => x.id === id);
    const freq = v?.rent_frequency || 'weekly';
    const per = currentPeriod(freq);
    setForm(f => ({
      ...f,
      vehicle_id: id,
      period_type: freq,
      period_start: per.period_start,
      period_end: per.period_end,
      amount_due: v?.rent_amount ? String(v.rent_amount) : f.amount_due,
    }));
  };

  const save = async () => {
    const v = vehicles.find(x => x.id === form.vehicle_id);
    if (!v) { setError('Selecciona una unidad.'); return; }
    const amount = parseFloat(form.amount_due);
    if (!amount || amount <= 0) { setError('Ingresa el monto de la renta.'); return; }
    if (!tenantId) { setError('Tu organización aún se está configurando.'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.entities.RentCharge.create({
        tenant_id: tenantId,
        vehicle_id: v.id,
        driver_id: v.assigned_driver_id || null,
        period_type: form.period_type,
        period_start: form.period_start,
        period_end: form.period_end,
        amount_due: amount,
        amount_paid: 0,
        status: 'pending',
        payments: [],
      });
      onSaved();
    } catch (e) {
      setError('No se pudo crear el cobro. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Cobro manual</h3>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Unidad</Label>
            <Select value={form.vehicle_id} onValueChange={onVehicle}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Selecciona unidad" /></SelectTrigger>
              <SelectContent>
                {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate}{v.unit_number ? ` · #${v.unit_number}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inicio</Label>
              <Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Fin</Label>
              <Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} className="mt-1 bg-background" />
            </div>
          </div>
          <div>
            <Label>Monto de la renta ($)</Label>
            <Input type="number" step="0.01" value={form.amount_due} onChange={e => setForm(f => ({ ...f, amount_due: e.target.value }))} className="mt-1 bg-background" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Guardando...' : 'Crear cobro'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
