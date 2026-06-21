import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Truck, Clock, DollarSign, MapPin, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/ui/form-error';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PageLoader } from '@/components/ui/spinner';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { useMe, useCurrentDriver, useEntityList, useInvalidateEntity } from '@/hooks/useEntities';

const PLATFORMS = [{ value: 'uber', label: 'Uber' }, { value: 'didi', label: 'DiDi' }, { value: 'particular', label: 'Particular' }];
const platformLabel = { uber: 'Uber', didi: 'DiDi', particular: 'Particular' };
const platformCls = { uber: 'bg-primary/10 text-primary', didi: 'bg-warning/10 text-warning', particular: 'bg-success/10 text-success' };

export default function DriverTrips() {
  const { isLoading: meLoading } = useMe();
  const { data: driver, isLoading: driverLoading } = useCurrentDriver();
  const enabled = !!driver;
  const { data: trips = [] } = useEntityList('Trip', { filter: { driver_id: driver?.id }, sort: '-started_at', limit: 50, enabled });
  const { data: vehicles = [] } = useEntityList('Vehicle', { filter: { assigned_driver_id: driver?.id }, enabled });
  const invalidate = useInvalidateEntity();
  const loading = meLoading || driverLoading;

  const vehicle = vehicles[0] || null;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ platform: 'uber', date: format(new Date(), 'yyyy-MM-dd'), earnings: '', distance_km: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalEarnings = trips.reduce((s, t) => s + (t.earnings || 0), 0);
  const totalKm = trips.reduce((s, t) => s + (t.distance_km || 0), 0);

  const submit = async () => {
    if (!driver || !vehicle) { setError('Necesitas un vehículo asignado para registrar viajes.'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.entities.Trip.create({
        tenant_id: driver.tenant_id,
        driver_id: driver.id,
        vehicle_id: vehicle.id,
        platform: form.platform,
        started_at: form.date ? new Date(`${form.date}T00:00:00`).toISOString() : new Date().toISOString(),
        earnings: form.earnings ? parseFloat(form.earnings) : null,
        distance_km: form.distance_km ? parseFloat(form.distance_km) : null,
      });
      invalidate('Trip');
      setShowForm(false);
      setForm({ platform: 'uber', date: format(new Date(), 'yyyy-MM-dd'), earnings: '', distance_km: '' });
    } catch {
      setError('No se pudo registrar el viaje. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="Mis Viajes"
        action={driver && (
          <Button size="sm" onClick={() => { setError(''); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Registrar
          </Button>
        )}
      />

      {/* Summary cards */}
      {trips.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold font-mono">{trips.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Viajes</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-success font-mono">${totalEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ingresos</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary font-mono">{totalKm.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">km</p>
          </div>
        </div>
      )}

      {/* Trip list */}
      <div className="space-y-2">
        {trips.map(trip => {
          const duration = trip.started_at && trip.ended_at
            ? Math.round((new Date(trip.ended_at).getTime() - new Date(trip.started_at).getTime()) / 60000)
            : null;
          return (
            <div key={trip.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${platformCls[trip.platform] || 'bg-muted text-muted-foreground'}`}>
                    {platformLabel[trip.platform] || trip.platform}
                  </span>
                  {trip.started_at && (
                    <span className="text-xs text-muted-foreground">{format(new Date(trip.started_at), 'dd MMM · HH:mm')}</span>
                  )}
                </div>
                {trip.earnings != null && (
                  <span className="text-sm font-bold text-success flex items-center gap-1 shrink-0 font-mono">
                    <DollarSign className="w-3.5 h-3.5" />{trip.earnings.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{duration} min</span>}
                {trip.distance_km != null && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trip.distance_km} km</span>}
              </div>
            </div>
          );
        })}
        {trips.length === 0 && (
          <EmptyState
            icon={Truck}
            title="Sin viajes registrados"
            description={vehicle ? 'Registra tu primer viaje para llevar el control de tus ingresos.' : 'Cuando tengas un vehículo asignado podrás registrar viajes.'}
            action={driver && vehicle && (
              <Button size="sm" onClick={() => { setError(''); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" />Registrar viaje</Button>
            )}
          />
        )}
      </div>

      {showForm && (
        <ResponsiveModal title="Registrar viaje" onClose={() => setShowForm(false)} maxWidth="sm">
          <div className="space-y-3">
            <div>
              <Label>Plataforma</Label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1 bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ingresos ($)</Label>
                <Input type="number" step="0.01" min="0" value={form.earnings} onChange={e => setForm(f => ({ ...f, earnings: e.target.value }))} className="mt-1 bg-background" placeholder="0.00" />
              </div>
              <div>
                <Label>Distancia (km)</Label>
                <Input type="number" step="0.1" min="0" value={form.distance_km} onChange={e => setForm(f => ({ ...f, distance_km: e.target.value }))} className="mt-1 bg-background" placeholder="0" />
              </div>
            </div>
            <FormError>{error}</FormError>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button onClick={submit} disabled={saving || !vehicle} className="flex-1">{saving ? 'Guardando...' : 'Registrar'}</Button>
            </div>
          </div>
        </ResponsiveModal>
      )}
    </div>
  );
}
