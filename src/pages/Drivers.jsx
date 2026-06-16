import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Star, Phone, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DriverForm from '@/components/drivers/DriverForm';
import DriverDetail from '@/components/drivers/DriverDetail';
import { useTenant } from '@/lib/TenantContext';

const statusLabel = { active: 'Activo', suspended: 'Suspendido', inactive: 'Inactivo' };
const statusColor = {
  active: 'bg-success/10 text-success',
  suspended: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
};

export default function Drivers() {
  const { tenantId, readOnly } = useTenant();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [editDriver, setEditDriver] = useState(null);

  const load = () => {
    const query = tenantId ? { tenant_id: tenantId } : {};
    base44.entities.Driver.filter(query, '-created_date').then(setDrivers).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const filtered = drivers.filter(d =>
    d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.license_no?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data) => {
    if (readOnly) throw new Error('Licencia en modo solo lectura: renueva tu pago para hacer cambios.');
    if (editDriver) {
      await base44.entities.Driver.update(editDriver.id, data);
    } else {
      if (!tenantId) throw new Error('Tu organización aún se está configurando. Espera unos segundos y vuelve a intentarlo.');
      await base44.entities.Driver.create({ ...data, tenant_id: tenantId });
    }
    setShowForm(false);
    setEditDriver(null);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Driver.delete(id);
    setSelectedDriver(null);
    load();
  };

  if (selectedDriver) {
    return (
      <DriverDetail
        driver={drivers.find(d => d.id === selectedDriver) || selectedDriver}
        onBack={() => setSelectedDriver(null)}
        onEdit={(d) => { setEditDriver(d); setShowForm(true); setSelectedDriver(null); }}
        onDelete={handleDelete}
        onRefresh={load}
      />
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Conductores</h1>
          <p className="text-sm text-muted-foreground">{drivers.length} en total</p>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={() => { setEditDriver(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Agregar
          </Button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o licencia..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDriver(d.id)}
              className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/50 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                {d.photo_url ? (
                  <img src={d.photo_url} alt={d.full_name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  d.full_name?.charAt(0)?.toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{d.full_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[d.status]}`}>
                    {statusLabel[d.status]}
                  </span>
                  {d.referred_by_driver_id && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">Referido</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {d.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{d.phone}</span>}
                  {d.rating && <span className="text-xs text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3 fill-warning text-warning" />{d.rating}</span>}
                  {d.license_no && <span className="text-xs text-muted-foreground">Lic: {d.license_no}</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-10 text-sm">Sin resultados</p>
          )}
        </div>
      )}

      {showForm && (
        <DriverForm
          driver={editDriver}
          drivers={drivers}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditDriver(null); }}
        />
      )}
    </div>
  );
}