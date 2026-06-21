import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, ChevronRight, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import VehicleForm from '@/components/vehicles/VehicleForm';
import VehicleDetail from '@/components/vehicles/VehicleDetail';
import { useTenant } from '@/lib/TenantContext';
import { useModulePerms } from '@/lib/modulePerms';
import { vehicleLimit, PLAN_LABELS } from '@/lib/plans';
import { useVehicles, useDrivers, useInvalidateEntity } from '@/hooks/useEntities';

const statusLabel = { active: 'Activo', maintenance: 'Mantenimiento', inactive: 'Inactivo' };
const statusColor = {
  active: 'bg-success/10 text-success',
  maintenance: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
};

export default function Vehicles() {
  const { tenantId, readOnly, tenant } = useTenant();
  const { can } = useModulePerms();
  const limit = vehicleLimit(tenant);
  const { data: vehicles = [], isLoading: loading } = useVehicles();
  const { data: drivers = [] } = useDrivers();
  const invalidate = useInvalidateEntity();
  const refresh = () => invalidate('Vehicle', 'Driver');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const filtered = vehicles.filter(v =>
    v.plate?.toLowerCase().includes(search.toLowerCase()) ||
    v.make?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data) => {
    if (readOnly) throw new Error('Licencia en modo solo lectura: renueva tu pago para hacer cambios.');
    if (editVehicle) {
      if (!can('vehicles', 'edit')) throw new Error('No tienes permiso para editar vehículos.');
      await base44.entities.Vehicle.update(editVehicle.id, data);
    } else {
      if (!can('vehicles', 'create')) throw new Error('No tienes permiso para crear vehículos.');
      if (!tenantId) throw new Error('Tu organización aún se está configurando. Espera unos segundos y vuelve a intentarlo.');
      if (vehicles.length >= limit) throw new Error(`Alcanzaste el límite de ${limit} vehículos de tu plan ${PLAN_LABELS[tenant?.plan] || ''}. Mejora tu plan para agregar más.`);
      await base44.entities.Vehicle.create({ ...data, tenant_id: tenantId });
    }
    setShowForm(false);
    setEditVehicle(null);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Vehicle.delete(id);
    setSelectedVehicle(null);
    refresh();
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
        onRefresh={refresh}
      />
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Vehículos"
        subtitle={`${vehicles.length}${Number.isFinite(limit) ? ` / ${limit}` : ''} en total`}
        action={!readOnly && can('vehicles', 'create') && (
          <Button size="sm" onClick={() => { setEditVehicle(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Agregar
          </Button>
        )}
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por placa, marca o modelo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
      </div>

      {loading ? (
        <ListSkeleton />
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
                    <p className="font-bold text-sm font-mono tracking-tight">{v.plate || (v.unit_number ? `#${v.unit_number}` : 'Sin identificar')}</p>
                    {v.plate && v.unit_number && <span className="text-xs text-muted-foreground">#{v.unit_number}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[v.status]}`}>{statusLabel[v.status]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.make} {v.model} {v.year && `· ${v.year}`} · {driver?.full_name || 'Sin asignar'}</p>
                  {v.odometer && <p className="text-xs text-muted-foreground">{v.odometer.toLocaleString()} km</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <EmptyState
              icon={Truck}
              title={search ? 'Sin resultados' : 'Aún no hay vehículos'}
              description={search ? 'Prueba con otra placa, marca o modelo.' : 'Agrega tu primera unidad para empezar a gestionar tu flotilla.'}
              action={!search && !readOnly && can('vehicles', 'create') && (
                <Button size="sm" onClick={() => { setEditVehicle(null); setShowForm(true); }} className="gap-2">
                  <Plus className="w-4 h-4" /> Agregar vehículo
                </Button>
              )}
            />
          )}
        </div>
      )}

      {showForm && (
        <VehicleForm vehicle={editVehicle} drivers={drivers} onSave={handleSave} onClose={() => { setShowForm(false); setEditVehicle(null); }} />
      )}
    </div>
  );
}