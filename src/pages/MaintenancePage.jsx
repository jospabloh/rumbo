import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import MaintenanceForm from '@/components/maintenance/MaintenanceForm';
import PartsList from '@/components/maintenance/PartsList';
import { useTenant } from '@/lib/TenantContext';
import { useModulePerms } from '@/lib/modulePerms';
import { useEntityList, useVehicles, useInvalidateEntity } from '@/hooks/useEntities';

export default function MaintenancePage({ defaultTab = 'maintenance' }) {
  const { tenantId, readOnly } = useTenant();
  const { can } = useModulePerms();
  const { data: records = [], isLoading: loading } = useEntityList('Maintenance', { sort: '-performed_at' });
  const { data: vehicles = [] } = useVehicles();
  const invalidate = useInvalidateEntity();
  const refresh = () => invalidate('Maintenance');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [tab, setTab] = useState(defaultTab);
  const [searchParams, setSearchParams] = useSearchParams();

  // Atajo desde el dashboard (/maintenance?new=1): abre el formulario de alta.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      if (!readOnly && can('maintenance', 'create')) { setTab('maintenance'); setEditRecord(null); setShowForm(true); }
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = records.filter(r => {
    const v = vehicles.find(x => x.id === r.vehicle_id);
    return (
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      v?.plate?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleSave = async (data) => {
    if (editRecord) {
      await base44.entities.Maintenance.update(editRecord.id, data);
    } else {
      await base44.entities.Maintenance.create({ ...data, tenant_id: tenantId });
    }
    setShowForm(false);
    setEditRecord(null);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Maintenance.delete(id);
    refresh();
  };

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Mantenimiento"
        subtitle={`${records.length} registros`}
        action={tab === 'maintenance' && !readOnly && can('maintenance', 'create') && (
          <Button size="sm" onClick={() => { setEditRecord(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Registrar
          </Button>
        )}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-4">
        {['maintenance', 'parts'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {t === 'maintenance' ? 'Mantenimientos' : 'Inventario'}
          </button>
        ))}
      </div>

      {tab === 'parts' ? (
        <PartsList vehicles={vehicles} />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por descripción o placa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
          </div>

          {loading ? (
            <ListSkeleton />
          ) : (
            <div className="space-y-2">
              {filtered.map(r => {
                const v = vehicles.find(x => x.id === r.vehicle_id);
                return (
                  <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.kind === 'preventive' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                          <Wrench className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{r.description || (r.kind === 'preventive' ? 'Mantenimiento preventivo' : 'Mantenimiento correctivo')}</p>
                          <p className="text-xs text-muted-foreground">{v?.plate || 'Vehículo'} · {r.performed_at}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.cost && <span className="text-sm font-bold">${parseFloat(r.cost).toFixed(2)}</span>}
                        <button onClick={() => handleDelete(r.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-2">✕</button>
                      </div>
                    </div>
                    {r.next_due_at && (
                      <p className="text-xs text-muted-foreground mt-2 ml-11">Próxima revisión: {r.next_due_at}</p>
                    )}
                    {r.photo_url && (
                      <a href={r.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary ml-11 mt-1 inline-block">Ver foto →</a>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <EmptyState
                  icon={Wrench}
                  title={search ? 'Sin resultados' : 'Sin mantenimientos registrados'}
                  description={search ? 'Prueba con otra descripción o placa.' : 'Registra el primer servicio para llevar el historial de tu flotilla.'}
                  action={!search && !readOnly && can('maintenance', 'create') && (
                    <Button size="sm" onClick={() => { setEditRecord(null); setShowForm(true); }} className="gap-2">
                      <Plus className="w-4 h-4" /> Registrar mantenimiento
                    </Button>
                  )}
                />
              )}
            </div>
          )}

          {showForm && (
            <MaintenanceForm record={editRecord} vehicles={vehicles} onSave={handleSave} onClose={() => { setShowForm(false); setEditRecord(null); }} />
          )}
        </>
      )}
    </div>
  );
}