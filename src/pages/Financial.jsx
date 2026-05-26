import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Fuel, AlertTriangle, Shield, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FuelLogForm from '@/components/financial/FuelLogForm';
import FineForm from '@/components/financial/FineForm';
import InsuranceClaimForm from '@/components/financial/InsuranceClaimForm';
import CostPerKm from '@/components/financial/CostPerKm';

const tabs = [
  { id: 'fuel', label: 'Combustible', icon: Fuel },
  { id: 'fines', label: 'Multas', icon: AlertTriangle },
  { id: 'insurance', label: 'Seguros', icon: Shield },
  { id: 'costs', label: 'Costo/km', icon: DollarSign },
];

export default function Financial() {
  const [tab, setTab] = useState('fuel');
  const [fuelLogs, setFuelLogs] = useState([]);
  const [fines, setFines] = useState([]);
  const [claims, setClaims] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      base44.entities.FuelLog.list('-logged_at'),
      base44.entities.Fine.list('-issued_at'),
      base44.entities.InsuranceClaim.list('-created_date'),
      base44.entities.Vehicle.list(),
      base44.entities.Driver.list(),
    ]).then(([f, fi, c, v, d]) => {
      setFuelLogs(f); setFines(fi); setClaims(c); setVehicles(v); setDrivers(d);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalFuel = fuelLogs.reduce((s, l) => s + (l.total_cost || 0), 0);
  const totalFines = fines.reduce((s, f) => s + (f.amount || 0), 0);
  const unpaidFines = fines.filter(f => !f.paid).length;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Financiero</h1>
          <p className="text-sm text-muted-foreground">Combustible · Multas · Seguros</p>
        </div>
        {tab !== 'costs' && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" />Registrar</Button>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold">${totalFuel.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Combustible</p>
        </div>
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
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : tab === 'fuel' ? (
        <div className="space-y-2">
          {fuelLogs.map(log => {
            const v = vehicles.find(x => x.id === log.vehicle_id);
            const d = drivers.find(x => x.id === log.driver_id);
            return (
              <div key={log.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Fuel className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{v?.plate || 'Vehículo'}</p>
                  <p className="text-xs text-muted-foreground">{d?.full_name || '—'} · {log.liters}L · {new Date(log.logged_at || log.created_date).toLocaleDateString()}</p>
                </div>
                <p className="text-sm font-bold">${parseFloat(log.total_cost || 0).toFixed(2)}</p>
              </div>
            );
          })}
          {fuelLogs.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Sin registros de combustible</p>}
        </div>
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

      {showForm && tab === 'fuel' && <FuelLogForm vehicles={vehicles} drivers={drivers} onSave={async (d) => { await base44.entities.FuelLog.create(d); setShowForm(false); load(); }} onClose={() => setShowForm(false)} />}
      {showForm && tab === 'fines' && <FineForm vehicles={vehicles} drivers={drivers} onSave={async (d) => { await base44.entities.Fine.create(d); setShowForm(false); load(); }} onClose={() => setShowForm(false)} />}
      {showForm && tab === 'insurance' && <InsuranceClaimForm vehicles={vehicles} drivers={drivers} onSave={async (d) => { await base44.entities.InsuranceClaim.create(d); setShowForm(false); load(); }} onClose={() => setShowForm(false)} />}
    </div>
  );
}