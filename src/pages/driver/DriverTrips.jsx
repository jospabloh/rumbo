import { Truck, Clock, DollarSign, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { PageLoader } from '@/components/ui/spinner';
import { useMe, useCurrentDriver, useEntityList } from '@/hooks/useEntities';

const platformLabel = { uber: 'Uber', didi: 'DiDi', particular: 'Particular' };
const platformCls = { uber: 'bg-primary/10 text-primary', didi: 'bg-warning/10 text-warning', particular: 'bg-success/10 text-success' };

export default function DriverTrips() {
  const { isLoading: meLoading } = useMe();
  const { data: driver, isLoading: driverLoading } = useCurrentDriver();
  const { data: trips = [] } = useEntityList('Trip', { filter: { driver_id: driver?.id }, sort: '-started_at', limit: 50, enabled: !!driver });
  const loading = meLoading || driverLoading;

  const totalEarnings = trips.reduce((s, t) => s + (t.earnings || 0), 0);
  const totalKm = trips.reduce((s, t) => s + (t.distance_km || 0), 0);

  if (loading) return <PageLoader />;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Mis Viajes</h1>

      {/* Summary cards */}
      {trips.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{trips.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Viajes</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-success">${totalEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ingresos</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalKm.toFixed(0)}</p>
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
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(trip.started_at), 'dd MMM · HH:mm')}
                    </span>
                  )}
                </div>
                {trip.earnings && (
                  <span className="text-sm font-bold text-success flex items-center gap-1 shrink-0">
                    <DollarSign className="w-3.5 h-3.5" />{trip.earnings.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{duration} min</span>}
                {trip.distance_km && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trip.distance_km} km</span>}
              </div>
            </div>
          );
        })}
        {trips.length === 0 && (
          <div className="text-center py-12">
            <Truck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Sin viajes registrados aún</p>
          </div>
        )}
      </div>
    </div>
  );
}