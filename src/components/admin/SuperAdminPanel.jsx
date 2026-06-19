import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Crown, Building2, RefreshCw, Edit2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { PLAN_LIMITS } from '@/lib/plans';

const PLANS = ['trial', 'starter', 'pro', 'enterprise'];
const STATUSES = ['active', 'expired', 'suspended', 'cancelled'];

const STATUS_COLOR = {
  active: 'text-success bg-success/10',
  expired: 'text-warning bg-warning/10',
  suspended: 'text-destructive bg-destructive/10',
  cancelled: 'text-muted-foreground bg-secondary',
};

const PLAN_COLOR = {
  trial:      'text-muted-foreground bg-secondary',
  starter:    'text-primary bg-primary/10',
  pro:        'text-warning bg-warning/10',
  enterprise: 'text-success bg-success/10',
};

function TenantRow({ license, onSave }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...license });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await base44.entities.TenantLicense.update(license.id, form);
    setSaving(false);
    setEditing(false);
    onSave();
  };

  const f = (key) => e => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Building2 className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{license.tenant_name || <span className="text-muted-foreground italic">Sin nombre</span>}</p>
          <p className="text-xs text-muted-foreground truncate">{license.owner_email || '—'}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${PLAN_COLOR[license.plan] || 'text-muted-foreground bg-secondary'}`}>{license.plan}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLOR[license.status] || 'text-muted-foreground bg-secondary'}`}>{license.status}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {open && (
        <div className="border-t border-border bg-secondary/20 px-4 py-4 space-y-4">
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
                <Input value={form.tenant_name || ''} onChange={f('tenant_name')} className="bg-secondary border-border text-sm h-8" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email del admin</label>
                <Input value={form.owner_email || ''} onChange={f('owner_email')} className="bg-secondary border-border text-sm h-8" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Plan</label>
                <Select value={form.plan} onValueChange={v => setForm(p => ({ ...p, plan: v, max_vehicles: PLAN_LIMITS[v].max_vehicles, max_drivers: PLAN_LIMITS[v].max_drivers }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLANS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Veh. máximos (0 = ilimitado)</label>
                <Input type="number" value={form.max_vehicles ?? ''} onChange={f('max_vehicles')} className="bg-secondary border-border text-sm h-8" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Conductores máximos (0 = ilimitado)</label>
                <Input type="number" value={form.max_drivers ?? ''} onChange={f('max_drivers')} className="bg-secondary border-border text-sm h-8" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fin del trial</label>
                <Input type="date" value={form.trial_ends_at || ''} onChange={f('trial_ends_at')} className="bg-secondary border-border text-sm h-8" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fecha renovación</label>
                <Input type="date" value={form.renews_at || ''} onChange={f('renews_at')} className="bg-secondary border-border text-sm h-8" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Notas internas</label>
                <Input value={form.notes || ''} onChange={f('notes')} className="bg-secondary border-border text-sm h-8" />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button size="sm" onClick={save} disabled={saving} className="gap-2"><Save className="w-3.5 h-3.5" />{saving ? 'Guardando...' : 'Guardar'}</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm({ ...license }); }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                <div><span className="text-muted-foreground">Plan: </span><span className="font-medium capitalize">{license.plan}</span></div>
                <div><span className="text-muted-foreground">Estado: </span><span className={`font-medium capitalize ${STATUS_COLOR[license.status]?.split(' ')[0]}`}>{license.status}</span></div>
                <div><span className="text-muted-foreground">Vehículos max: </span><span className="font-medium">{!license.max_vehicles ? 'Ilimitado' : license.max_vehicles}</span></div>
                <div><span className="text-muted-foreground">Conductores max: </span><span className="font-medium">{!license.max_drivers ? 'Ilimitado' : license.max_drivers}</span></div>
                {license.trial_ends_at && <div><span className="text-muted-foreground">Trial hasta: </span><span className="font-medium">{new Date(license.trial_ends_at).toLocaleDateString('es-MX')}</span></div>}
                {license.renews_at && <div><span className="text-muted-foreground">Renovación: </span><span className="font-medium">{new Date(license.renews_at).toLocaleDateString('es-MX')}</span></div>}
                {license.notes && <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground">Notas: </span><span className="font-medium">{license.notes}</span></div>}
              </div>
              <Button size="sm" variant="outline" className="gap-2 text-xs mt-1" onClick={() => setEditing(true)}>
                <Edit2 className="w-3.5 h-3.5" /> Editar licencia
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminPanel() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const all = await base44.entities.TenantLicense.list('-created_date', 100);
    setTenants(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <section className="bg-card border border-warning/40 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-warning/5">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-warning" />
          <h2 className="text-sm font-semibold text-warning uppercase tracking-wide">Super Admin — Todos los Tenants</h2>
        </div>
        <Button size="sm" variant="ghost" className="gap-2 text-xs text-muted-foreground" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </div>

      <div className="p-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner className="w-5 h-5 border-4" /></div>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No hay tenants registrados.</p>
        ) : (
          tenants.map(t => <TenantRow key={t.id} license={t} onSave={load} />)
        )}
      </div>
    </section>
  );
}