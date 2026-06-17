import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, Clock, CheckCircle2, Plus, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon
delete (/** @type {any} */ (L.Icon.Default.prototype))._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const statusConfig = {
  pending: { label: 'Esperando respuesta', cls: 'text-warning bg-warning/10', icon: Clock },
  fulfilled: { label: 'Ubicación recibida', cls: 'text-success bg-success/10', icon: CheckCircle2 },
  expired: { label: 'Expirada', cls: 'text-muted-foreground bg-muted', icon: Clock },
};

export default function Location() {
  const [requests, setRequests] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [driverRequest, setDriverRequest] = useState(null);
  const [sharing, setSharing] = useState(false);

  const load = () => {
    Promise.all([
      base44.entities.LocationRequest.list('-requested_at', 20),
      base44.entities.Vehicle.list(),
      base44.entities.Driver.list(),
      base44.auth.me(),
    ]).then(([r, v, d, u]) => {
      setRequests(r);
      setVehicles(v);
      setDrivers(d);
      setUser(u);
      // For drivers: find pending request for them
      if (u?.role === 'driver') {
        const dr = d.find(x => x.profile_id === u.id);
        if (dr) {
          const pending = r.find(x => x.driver_id === dr.id && x.status === 'pending');
          setDriverRequest(pending || null);
        }
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Check URL param for pre-selected vehicle
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vid = params.get('vehicle');
    if (vid) setSelectedVehicle(vid);
  }, []);

  const handleRequestLocation = async () => {
    if (!selectedVehicle) return;
    setCreating(true);
    const vehicle = vehicles.find(v => v.id === selectedVehicle);
    await base44.entities.LocationRequest.create({
      vehicle_id: selectedVehicle,
      driver_id: vehicle?.assigned_driver_id,
      requested_by: user?.id,
      status: 'pending',
      requested_at: new Date().toISOString(),
    });
    setSelectedVehicle('');
    load();
    setCreating(false);
  };

  const handleShareLocation = async () => {
    if (!driverRequest) return;
    setSharing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await base44.entities.LocationRequest.update(driverRequest.id, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          status: 'fulfilled',
          responded_at: new Date().toISOString(),
        });
        setSharing(false);
        setDriverRequest(null);
        load();
      },
      () => { setSharing(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const isAdmin = user?.role !== 'driver';
  const fulfilledRequests = requests.filter(r => r.status === 'fulfilled' && r.lat && r.lng);

  if (loading) {
    return <div className="flex justify-center items-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold">Ubicación</h1>
        <p className="text-sm text-muted-foreground">Solicitudes bajo request — sin rastreo continuo</p>
      </div>

      {/* Driver view: pending request to respond */}
      {!isAdmin && driverRequest && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-5 mb-4 text-center">
          <Navigation className="w-8 h-8 text-warning mx-auto mb-2" />
          <p className="font-semibold mb-1">El dispatcher solicita tu ubicación</p>
          <p className="text-sm text-muted-foreground mb-4">Toca el botón para compartir una sola vez. No se rastreará continuamente.</p>
          <Button onClick={handleShareLocation} disabled={sharing} className="gap-2">
            <MapPin className="w-4 h-4" />
            {sharing ? 'Obteniendo ubicación...' : 'Compartir mi ubicación'}
          </Button>
        </div>
      )}

      {/* Admin: request location */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">Solicitar ubicación</h2>
          <div className="flex gap-3">
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="bg-background flex-1"><SelectValue placeholder="Seleccionar vehículo" /></SelectTrigger>
              <SelectContent>
                {vehicles.filter(v => v.assigned_driver_id).map(v => {
                  const d = drivers.find(x => x.id === v.assigned_driver_id);
                  return <SelectItem key={v.id} value={v.id}>{v.plate} — {d?.full_name || 'Sin conductor'}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Button onClick={handleRequestLocation} disabled={creating || !selectedVehicle} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />{creating ? 'Enviando...' : 'Solicitar'}
            </Button>
          </div>
        </div>
      )}

      {/* Map with fulfilled requests */}
      {fulfilledRequests.length > 0 && (
        <div className="mb-4 rounded-xl overflow-hidden border border-border" style={{ height: 280 }}>
          <MapContainer
            center={[fulfilledRequests[0].lat, fulfilledRequests[0].lng]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
            {fulfilledRequests.map(r => {
              const v = vehicles.find(x => x.id === r.vehicle_id);
              const d = drivers.find(x => x.id === r.driver_id);
              return (
                <Marker key={r.id} position={[r.lat, r.lng]}>
                  <Popup>
                    <strong>{v?.plate}</strong><br />
                    {d?.full_name}<br />
                    {r.responded_at && new Date(r.responded_at).toLocaleString()}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      {/* Requests list */}
      <h2 className="font-semibold text-sm mb-3">Historial de solicitudes</h2>
      <div className="space-y-2">
        {requests.map(r => {
          const v = vehicles.find(x => x.id === r.vehicle_id);
          const d = drivers.find(x => x.id === r.driver_id);
          const { label, cls, icon: Icon } = statusConfig[r.status] || statusConfig.pending;
          return (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{v?.plate || 'Vehículo'} · {d?.full_name || 'Conductor'}</p>
                <p className="text-xs text-muted-foreground">{r.requested_at && new Date(r.requested_at).toLocaleString()}</p>
                {r.status === 'fulfilled' && r.lat && (
                  <p className="text-xs text-success mt-0.5">📍 {r.lat.toFixed(5)}, {r.lng.toFixed(5)}</p>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{label}</span>
            </div>
          );
        })}
        {requests.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Sin solicitudes</p>}
      </div>
    </div>
  );
}