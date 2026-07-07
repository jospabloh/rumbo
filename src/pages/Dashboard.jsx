import { Link, useNavigate } from 'react-router-dom';
import { Truck, Users, AlertTriangle, MessageSquare, TrendingUp, DollarSign, Banknote, Gauge, Plus, Wrench, Receipt, TrendingDown, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import StatCard from '@/components/dashboard/StatCard';
import AlertBadge from '@/components/dashboard/AlertBadge';
import RevenueTrend from '@/components/dashboard/RevenueTrend';
import FleetProfitMatrixCard from '@/components/dashboard/FleetProfitMatrixCard';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { useTenant } from '@/lib/TenantContext';
import { useModulePerms } from '@/lib/modulePerms';
import { isAdminOrOwner } from '@/lib/permissions';
import { monthlyExpenses, monthlyIncome, pendingFines, maintenanceDue } from '@/lib/dashboard';
import { useVehicles, useDrivers, useAlerts, useMessages, useRentCharges, useEntityList } from '@/hooks/useEntities';

export default function Dashboard() {
  const navigate = useNavigate();
  const { readOnly, licenseInfo, userRole } = useTenant();
  const { can } = useModulePerms();
  const vehiclesQ = useVehicles();
  const driversQ = useDrivers();
  const alertsQ = useAlerts({ filter: { resolved: false } });
  const messagesQ = useMessages({ filter: { read: false } });
  const rentChargesQ = useRentCharges({ sort: '-period_start', limit: 300 });
  // Fuentes para el centro de mando: infracciones, egresos y taller.
  const finesQ = useEntityList('Fine', { sort: '-issued_at', limit: 500 });
  const fuelQ = useEntityList('FuelLog', { sort: '-logged_at', limit: 500 });
  const maintenanceQ = useEntityList('Maintenance', { sort: '-performed_at', limit: 500 });
  const claimsQ = useEntityList('InsuranceClaim', { sort: '-incident_at', limit: 500 });
  const expensesQ = useEntityList('Expense', { sort: '-expense_date', limit: 500 });

  const vehicles = vehiclesQ.data ?? [];
  const drivers = driversQ.data ?? [];
  const alerts = alertsQ.data ?? [];
  const messages = messagesQ.data ?? [];
  const rentCharges = rentChargesQ.data ?? [];
  const fines = finesQ.data ?? [];
  const fuel = fuelQ.data ?? [];
  const maintenance = maintenanceQ.data ?? [];
  const claims = claimsQ.data ?? [];
  const generalExpenses = expensesQ.data ?? [];
  const loading = vehiclesQ.isLoading || driversQ.isLoading || alertsQ.isLoading || messagesQ.isLoading || rentChargesQ.isLoading;

  const activeVehicles = vehicles.filter(v => v.status === 'active').length;
  const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
  const inactiveVehicles = vehicles.filter(v => v.status === 'inactive').length;
  const activeDrivers = drivers.filter(d => d.status === 'active').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const collectedToday = rentCharges.reduce((s, c) =>
    s + (c.payments || []).filter(p => p.paid_at === todayStr).reduce((a, p) => a + (p.amount || 0), 0), 0);
  const totalDue = rentCharges.reduce((s, c) => s + Math.max((c.amount_due || 0) - (c.amount_paid || 0), 0), 0);
  const totalVehicles = vehicles.length;
  const availability = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;

  // Centro de mando: métricas agregadas del mes en curso (funciones puras y testeadas).
  const incomeMonth = monthlyIncome(rentCharges);
  const expenses = monthlyExpenses({ fuel, fines, maintenance, claims, expenses: generalExpenses });
  const fineStatus = pendingFines(fines);
  const maintDue = maintenanceDue(maintenance);

  // Tarjeta de licencia: días para vencer + color según urgencia (espejo de license.js).
  const licenseDays = licenseInfo?.daysLeft;
  const licenseValue = licenseDays == null ? 'Activa' : `${licenseDays}d`;
  const licenseSub = licenseInfo?.state === 'readonly' ? 'solo lectura'
    : licenseInfo?.state === 'past_due' ? 'pago pendiente'
    : licenseInfo?.state === 'disabled' ? 'desactivada'
    : licenseDays == null ? 'sin vencimiento' : 'vigente';
  const licenseColor = licenseInfo?.state === 'readonly' || licenseInfo?.state === 'disabled' ? 'red'
    : (licenseDays != null && licenseDays <= 7) || licenseInfo?.state === 'past_due' ? 'yellow'
    : 'green';

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <PageHeader title="Dashboard" subtitle={format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })} className="mb-0" />

      {/* Acciones rápidas: atajos con el formulario pre-cargado */}
      {!readOnly && (can('vehicles', 'create') || can('drivers', 'create') || can('maintenance', 'create')) && (
        <div className="flex flex-wrap gap-2">
          {can('vehicles', 'create') && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate('/vehicles?new=1')}>
              <Plus className="w-4 h-4" /> Agregar vehículo
            </Button>
          )}
          {can('drivers', 'create') && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate('/drivers?new=1')}>
              <Plus className="w-4 h-4" /> Agregar conductor
            </Button>
          )}
          {can('maintenance', 'create') && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate('/maintenance?new=1')}>
              <Wrench className="w-4 h-4" /> Registrar mantenimiento
            </Button>
          )}
        </div>
      )}

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

      {/* Stats grid — cada tarjeta es accionable y lleva a su sección */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Truck} label="Vehículos activos" value={activeVehicles} sub={`${maintenanceVehicles} en mant. · ${inactiveVehicles} inactivos`} color="blue" link="/vehicles" />
        <StatCard icon={Users} label="Conductores" value={activeDrivers} sub={`${drivers.length} total`} color="green" link="/drivers" />
        <StatCard icon={AlertTriangle} label="Alertas abiertas" value={alerts.length} sub={`${criticalAlerts.length} críticas`} color="red" link="/alerts" />
        <StatCard icon={MessageSquare} label="No leídos" value={messages.length} sub="mensajes" color="purple" link="/messages" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Ingresos hoy" value={`$${collectedToday.toLocaleString()}`} sub="rentas cobradas" color="green" link="/rentas" />
        <StatCard icon={Banknote} label="Por cobrar" value={`$${totalDue.toLocaleString()}`} sub="rentas pendientes" color="red" link="/rentas" />
        <StatCard icon={Gauge} label="Disponibilidad" value={`${availability}%`} sub="unidades operando" color="blue" link="/vehicles" />
        <StatCard icon={TrendingUp} label="Flota total" value={totalVehicles} sub="vehículos" color="gray" link="/vehicles" />
      </div>

      {/* Centro de mando: finanzas del mes, infracciones, taller y licencia */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Ingresos del mes" value={`$${incomeMonth.toLocaleString()}`} sub="rentas cobradas" color="green" link="/rentas" />
        <StatCard icon={TrendingDown} label="Egresos del mes" value={`$${expenses.total.toLocaleString()}`} sub="combustible · multas · taller" color="red" link="/financial" />
        <StatCard icon={Receipt} label="Infracciones" value={fineStatus.count} sub={`$${fineStatus.amount.toLocaleString()} pendiente`} color="yellow" link="/financial" />
        <StatCard icon={Wrench} label="Taller" value={maintDue.overdue + maintDue.dueSoon} sub={`${maintDue.overdue} vencidos · ${maintDue.dueSoon} por vencer`} color={maintDue.overdue > 0 ? 'red' : 'yellow'} link="/maintenance" />
      </div>

      {/* Estado de licencia */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ShieldCheck} label="Licencia" value={licenseValue} sub={licenseSub} color={licenseColor} link="/billing" />
      </div>

      {/* Revenue trend */}
      <RevenueTrend charges={rentCharges} />

      {/* Utilidad por unidad (vista previa de /reports) — solo owner/admin: la
          función fleetUnitMetrics devuelve 403 para dispatcher/mechanic. */}
      {isAdminOrOwner(userRole) && <FleetProfitMatrixCard />}

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
                      <p className="text-sm font-medium font-mono tracking-tight">{v.plate}</p>
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
            {vehicles.length === 0 && (
              <EmptyState icon={Truck} title="Sin vehículos" description="Agrega unidades para ver el estado de tu flotilla." className="py-8" />
            )}
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
              <EmptyState icon={AlertTriangle} title="Sin alertas activas" description="Tu flotilla está al día." className="py-8" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}