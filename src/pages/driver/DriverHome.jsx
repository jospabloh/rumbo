import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Truck, Bell, Star, MapPin } from 'lucide-react';
import AlertBadge from '@/components/dashboard/AlertBadge';

export default function DriverHome() {
  const [user, setUser] = useState(null);
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [locationRequest, setLocationRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const drivers = await base44.entities.Driver.list();
      const dr = drivers.find(d => d.profile_id === u.id);
      if (dr) {
        setDriver(dr);
        const vehicles = await base44.entities.Vehicle.filter({ assigned_driver_id: dr.id });
        if (vehicles[0]) setVehicle(vehicles[0]);
        const myAlerts = await base44.entities.Alert.filter({ driver_id: dr.id, resolved: false });
        setAlerts(myAlerts);
        // Check for pending location request
        const requests = await base44.entities.LocationRequest.filter({ driver_id: dr.id, status: 'pending' });
        setLocationRequest(requests[0] || null);
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleShareLocation = () => {
    if (!locationRequest) return;
    setSharing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await base44.entities.LocationRequest.update(locationRequest.id, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          status: 'fulfilled',
          responded_at: new Date().toISOString(),
        });
        setLocationRequest(null);
        setSharing(false);
      },
      () => setSharing(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (loading) return <div className="flex justify-center items-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Hola, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">Panel del conductor</p>
      </div>

      {/* Location request banner */}
      {locationRequest && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">El dispatcher solicita tu ubicación</p>
              <p className="text-xs text-muted-foreground">Solo se comparte una vez, sin rastreo</p>
            </div>
            <button onClick={handleShareLocation} disabled={sharing}
              className="bg-warning text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity shrink-0">
              {sharing ? '...' : 'Compartir'}
            </button>
          </div>
        </div>
      )}

      {/* Vehicle card */}
      {vehicle ? (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold">{vehicle.plate}</p>
              <p className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}</p>
            </div>
            <span className="ml-auto text-xs px-2 py-0.5 bg-success/10 text-success rounded-full font-medium">Asignado</span>
          </div>
          {vehicle.odometer && <p className="text-xs text-muted-foreground">{vehicle.odometer.toLocaleString()} km</p>}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Truck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sin vehículo asignado</p>
        </div>
      )}

      {/* Driver rating */}
      {driver?.rating && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center text-warning">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{driver.rating}</p>
            <p className="text-xs text-muted-foreground">Tu calificación</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-warning" />
            <h2 className="font-semibold text-sm">Tus alertas ({alerts.length})</h2>
          </div>
          <div className="space-y-1">
            {alerts.slice(0, 3).map(a => <AlertBadge key={a.id} alert={a} />)}
            {alerts.length > 3 && <p className="text-xs text-muted-foreground text-center pt-1">+{alerts.length - 3} más</p>}
          </div>
        </div>
      )}
    </div>
  );
}