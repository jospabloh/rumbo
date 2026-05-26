import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, ChevronRight, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VehicleForm from '@/components/vehicles/VehicleForm';
import VehicleDetail from '@/components/vehicles/VehicleDetail';

const statusLabel = { active: 'Activo', maintenance: 'Mantenimiento', inactive: 'Inactivo' };
const statusColor = {
  active: 'bg-success/10 text-success',
  maintenance: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
};

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const load = () => {
    Promise.all([
      base44.entities.Vehicle.list(),
      base44.entities.Driver.list(),
    ]).then(([v, d]) => { setVehicles(v); setDrivers(d); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = vehicles.filter(v =>
    v.plate?.toLowerCase().includes(search.toLowerCase()) ||
    v.make?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data) => {
    if (editVehicle) {
      await base44.entities.Vehicle.update(editVehicle.id, data);
    } else {
      await base44.entities.Vehicle.create(data);
    }
    setShowForm(false);
    setEditVehicle(null);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Vehicle.delete(id);
    setSelectedVehicle(null);
    load();
  };

  if (selectedVehicle) {
    const v = vehicles.find(x => x.id === selectedVehicle);
    if (!v) return null;
    return (
      <VehicleDetail
        vehicle={v}
        drivers={drivers}
        onBack={() => setSelectedVehicle(null)}
        onEdit={(veh) => { setEditVehicle(veh); setShowForm(true); setSelectedVehicle(null); }}
        onDelete={handleDelete}
        onRefresh={load}
      />
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Vehículos</h1>
          <p className="text-sm text-muted-foreground">{vehicles.length} en total</p>
        </div>
        <Button size="sm" onClick={() => { setEditVehicle(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Agregar
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por placa, marca o modelo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => {
            const driver = drivers.find(d => d.id === v.assigned_driver_id);
            return (
              <button key={v.id} onClick={() => setSelectedVehicle(v.id)}
                className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/50 transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{v.plate}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[v.status]}`}>{statusLabel[v.status]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.make} {v.model} {v.year && `· ${v.year}`} · {driver?.full_name || 'Sin asignar'}</p>
                  {v.odometer && <p className="text-xs text-muted-foreground">{v.odometer.toLocaleString()} km</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Sin resultados</p>}
        </div>
      )}

      {showForm && (
        <VehicleForm vehicle={editVehicle} drivers={drivers} onSave={handleSave} onClose={() => { setShowForm(false); setEditVehicle(null); }} />
      )}
    </div>
  );
}