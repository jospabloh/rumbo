import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, AlertTriangle, Shield, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import FineForm from '@/components/financial/FineForm';
import InsuranceClaimForm from '@/components/financial/InsuranceClaimForm';
import CostPerKm from '@/components/financial/CostPerKm';
import { useTenant } from '@/lib/TenantContext';
import { useModulePerms } from '@/lib/modulePerms';
import { useEntityList, useVehicles, useDrivers, useInvalidateEntity } from '@/hooks/useEntities';

const tabs = [
  { id: 'fines', label: 'Multas', icon: AlertTriangle },
  { id: 'insurance', label: 'Seguros', icon: Shield },
  { id: 'costs', label: 'Costo/km', icon: DollarSign },
];

export default function Financial() {
  const { tenantId, readOnly } = useTenant();
  const { can } = useModulePerms();
  const [tab, setTab] = useState('fines');
  const [showForm, setShowForm] = useState(false);
  const finesQ = useEntityList('Fine', { sort: '-issued_at' });
  const claimsQ = useEntityList('InsuranceClaim', { sort: '-created_date' });
  const { data: vehicles = [] } = useVehicles();
  const { data: drivers = [] } = useDrivers();
  const invalidate = useInvalidateEntity();
  const fines = finesQ.data ?? [];
  const claims = claimsQ.data ?? [];
  const loading = finesQ.isLoading || claimsQ.isLoading;

  const totalFines = fines.reduce((s, f) => s + (f.amount || 0), 0);
  const unpaidFines = fines.filter(f => !f.paid).length;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Financiero</h1>
          <p className="text-sm text-muted-foreground">Multas · Seguros · Costo/km</p>
        </div>
        {tab !== 'costs' && !readOnly && can(tab, 'create') && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" />Registrar</Button>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold">${totalFines.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">{unpaidFines} multas pend.</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold">{claims.filter(c => c.status === 'open').length}</p>
          <p className="text-xs text-muted-foreground">Reclamos abiertos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-4 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : tab === 'fines' ? (
        <div className="space-y-2">
          {fines.map(f => {
            const v = vehicles.find(x => x.id === f.vehicle_id);
            const d = drivers.find(x => x.id === f.driver_id);
            return (
              <div key={f.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${f.paid ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{f.fine_type || 'Multa'}</p>
                  <p className="text-xs text-muted-foreground">{d?.full_name} · {v?.plate} · {f.issued_at}</p>
                  {f.points > 0 && <p className="text-xs text-warning">{f.points} pts</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${parseFloat(f.amount || 0).toFixed(2)}</p>
                  <span className={`text-xs ${f.paid ? 'text-success' : 'text-destructive'}`}>{f.paid ? 'Pagada' : 'Pendiente'}</span>
                </div>
              </div>
            );
          })}
          {fines.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Sin multas registradas</p>}
        </div>
      ) : tab === 'insurance' ? (
        <div className="space-y-2">
          {claims.map(c => {
            const v = vehicles.find(x => x.id === c.vehicle_id);
            const d = drivers.find(x => x.id === c.driver_id);
            const statusColor = { open: 'text-warning', approved: 'text-success', denied: 'text-destructive', closed: 'text-muted-foreground' };
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{c.description || 'Reclamo de seguro'}</p>
                    <p className="text-xs text-muted-foreground">{v?.plate} · {d?.full_name} · {c.incident_at}</p>
                  </div>
                  <div className="text-right">
                    {c.claim_amount && <p className="text-sm font-bold">${parseFloat(c.claim_amount).toFixed(2)}</p>}
                    <span className={`text-xs font-medium capitalize ${statusColor[c.status]}`}>{c.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {claims.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Sin reclamos de seguro</p>}
        </div>
      ) : (
        <CostPerKm vehicles={vehicles} />
      )}

      {showForm && tab === 'fines' && <FineForm vehicles={vehicles} drivers={drivers} onSave={async (d) => { await base44.entities.Fine.create({ ...d, tenant_id: tenantId }); setShowForm(false); invalidate('Fine'); }} onClose={() => setShowForm(false)} />}
      {showForm && tab === 'insurance' && <InsuranceClaimForm vehicles={vehicles} drivers={drivers} onSave={async (d) => { await base44.entities.InsuranceClaim.create({ ...d, tenant_id: tenantId }); setShowForm(false); invalidate('InsuranceClaim'); }} onClose={() => setShowForm(false)} />}
    </div>
  );
}