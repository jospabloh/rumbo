import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { getLicenseInfo } from '@/lib/license';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Search, CheckCircle2, RefreshCw } from 'lucide-react';

const stateMeta = {
  active: { label: 'Activa', cls: 'bg-success/10 text-success' },
  past_due: { label: 'Pago pendiente', cls: 'bg-warning/10 text-warning' },
  readonly: { label: 'Solo lectura', cls: 'bg-warning/10 text-warning' },
  disabled: { label: 'Desactivada', cls: 'bg-destructive/10 text-destructive' },
};

export default function Licenses() {
  const { isAppOwner, loading: tenantLoading } = useTenant();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    base44.functions.invoke('licensesAdmin', { action: 'list' })
      .then(r => setTenants(r?.data?.tenants || []))
      .catch(() => setError('No se pudieron cargar las licencias.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isAppOwner) load(); else setLoading(false); }, [isAppOwner]);

  const renew = async (tenant, cycle) => {
    setBusyId(tenant.id);
    setError('');
    try {
      await base44.functions.invoke('licensesAdmin', { action: 'renew', tenantId: tenant.id, cycle });
      load();
    } catch (e) {
      setError('No se pudo renovar la licencia.');
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (tenant, status) => {
    setBusyId(tenant.id);
    setError('');
    try {
      await base44.functions.invoke('licensesAdmin', { action: 'set_status', tenantId: tenant.id, status });
      load();
    } catch (e) {
      setError('No se pudo actualizar el estado.');
    } finally {
      setBusyId(null);
    }
  };

  if (tenantLoading) return null;

  if (!isAppOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Shield className="w-12 h-12 opacity-30" />
        <p className="text-sm">Sección exclusiva del owner de la app.</p>
      </div>
    );
  }

  const filtered = tenants.filter(t => {
    if (!search) return true;
    const hay = `${t.tenant_name || ''} ${t.owner_email || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Licencias</h1>
          <p className="text-sm text-muted-foreground">{tenants.length} tenant(s) · gestión de pagos y vigencia</p>
        </div>
        <Button size="sm" variant="ghost" className="gap-2 text-xs text-muted-foreground" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o correo del admin..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const info = getLicenseInfo(t);
            const meta = stateMeta[info.state] || stateMeta.active;
            const busy = busyId === t.id;
            return (
              <div key={t.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{t.tenant_name || 'Sin nombre'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
                      <span className="text-xs text-muted-foreground capitalize">{t.plan}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.owner_email || 'sin admin'}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence: <span className="text-foreground font-medium">{t.current_period_end || t.trial_ends_at || '—'}</span>
                      {Array.isArray(t.members) ? ` · ${t.members.length} miembro(s)` : ''}
                      {t.last_payment_at ? ` · último pago ${t.last_payment_at}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Button size="sm" disabled={busy} onClick={() => renew(t, 'monthly')} className="gap-1 h-8">
                    <CheckCircle2 className="w-3.5 h-3.5" />Confirmar pago mensual
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => renew(t, 'annual')} className="h-8">
                    Renovar anual
                  </Button>
                  <Select value={t.status || 'active'} onValueChange={(v) => setStatus(t, v)} disabled={busy}>
                    <SelectTrigger className="h-8 w-36 text-xs ml-auto"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activa</SelectItem>
                      <SelectItem value="suspended">Suspender</SelectItem>
                      <SelectItem value="cancelled">Cancelar</SelectItem>
                      <SelectItem value="expired">Expirada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Sin tenants.</p>}
        </div>
      )}
    </div>
  );
}
