import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Truck, Users, AlertTriangle, MessageSquare, TrendingUp, DollarSign, Star, Fuel } from 'lucide-react';
import { format, isToday } from 'date-fns';
import StatCard from '@/components/dashboard/StatCard';
import AlertBadge from '@/components/dashboard/AlertBadge';
import { useTenant } from '@/lib/TenantContext';

export default function Dashboard() {
  const { tenantId } = useTenant();
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [trips, setTrips] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = tenantId ? { tenant_id: tenantId } : {};
    Promise.all([
      base44.entities.Vehicle.filter(q),
      base44.entities.Driver.filter(q),
      base44.entities.Alert.filter({ ...q, resolved: false }),
      base44.entities.Message.filter({ read: false, tenant_id: tenantId }),
      base44.entities.Trip.filter(q, '-started_at', 100),
      base44.entities.FuelLog.filter(q, '-logged_at', 50),
    ]).then(([v, d, a, m, t, f]) => {
      setVehicles(v);
      setDrivers(d);
      setAlerts(a);
      setMessages(m);
      setTrips(t);
      setFuelLogs(f);
    }).finally(() => setLoading(false));
  }, [tenantId]);

  const activeVehicles = vehicles.filter(v => v.status === 'active').length;
  const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
  const inactiveVehicles = vehicles.filter(v => v.status === 'inactive').length;
  const activeDrivers = drivers.filter(d => d.status === 'active').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const todayTrips = trips.filter(t => t.started_at && isToday(new Date(t.started_at)));
  const totalEarnings = todayTrips.reduce((s, t) => s + (t.earnings || 0), 0);
  const avgRating = drivers.length > 0 ? (drivers.reduce((s, d) => s + (d.rating || 0), 0) / drivers.filter(d => d.rating).length || 0).toFixed(1) : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d 'de' MMMM yyyy")}</p>
      </div>

      {/* Critical alerts banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">
            {criticalAlerts.length} alerta{criticalAlerts.length > 1 ? 's' : ''} crítica{criticalAlerts.length > 1 ? 's' : ''} requiere{criticalAlerts.length === 1 ? '' : 'n'} atención inmediata
          </p>
          <Link to="/alerts" className="ml-auto text-xs text-destructive underline shrink-0">Ver →</Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Truck} label="Vehículos activos" value={activeVehicles} sub={`${maintenanceVehicles} en mant. · ${inactiveVehicles} inactivos`} color="blue" />
        <StatCard icon={Users} label="Conductores" value={activeDrivers} sub={`${drivers.length} total`} color="green" />
        <StatCard icon={AlertTriangle} label="Alertas abiertas" value={alerts.length} sub={`${criticalAlerts.length} críticas`} color="red" link="/alerts" />
        <StatCard icon={MessageSquare} label="No leídos" value={messages.length} sub="mensajes" color="purple" link="/messages" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Fuel} label="Viajes hoy" value={todayTrips.length} sub="completados" color="blue" />
        <StatCard icon={DollarSign} label="Ingresos hoy" value={`$${totalEarnings.toFixed(0)}`} sub="suma de viajes" color="green" />
        <StatCard icon={Star} label="Rating promedio" value={avgRating} sub="flotilla" color="yellow" />
        <StatCard icon={TrendingUp} label="Flota total" value={vehicles.length} sub="vehículos" color="gray" />
      </div>

      {/* Fleet status */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm mb-3">Estado de Flotilla</h2>
          <div className="space-y-2">
            {vehicles.slice(0, 6).map(v => {
              const driver = drivers.find(d => d.id === v.assigned_driver_id);
              return (
                <Link key={v.id} to="/vehicles" className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${v.status === 'active' ? 'bg-success' : v.status === 'maintenance' ? 'bg-warning' : 'bg-muted-foreground'}`} />
                    <div>
                      <p className="text-sm font-medium">{v.plate}</p>
                      <p className="text-xs text-muted-foreground">{v.make} {v.model} · {driver?.full_name || 'Sin asignar'}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    v.status === 'active' ? 'bg-success/10 text-success' :
                    v.status === 'maintenance' ? 'bg-warning/10 text-warning' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {v.status === 'active' ? 'Activo' : v.status === 'maintenance' ? 'Mant.' : 'Inactivo'}
                  </span>
                </Link>
              );
            })}
            {vehicles.length > 6 && <p className="text-xs text-muted-foreground text-center pt-1">+{vehicles.length - 6} más</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Alertas Recientes</h2>
            <Link to="/alerts" className="text-xs text-primary">Ver todas →</Link>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 6).map(alert => (
              <AlertBadge key={alert.id} alert={alert} />
            ))}
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin alertas activas</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}