import { Truck, Wrench, Banknote, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useMe, useEntityList } from '@/hooks/useEntities';
import { statusOf, isOverdue, statusMeta } from '@/components/rentas/rentUtils';
import { getSetting } from '@/lib/settings';
import { useTenant } from '@/lib/TenantContext';

const VEHICLE_STATUS_META = {
  active: { label: 'Activa', cls: 'bg-success/10 text-success' },
  maintenance: { label: 'En taller', cls: 'bg-warning/10 text-warning' },
  inactive: { label: 'Inactiva', cls: 'bg-muted text-muted-foreground' },
};

const EXPIRY_FIELDS = [
  ['insurance_expiry', 'Seguro'],
  ['inspection_expiry', 'Inspección'],
  ['registration_expiry', 'Tenencia/registro'],
  ['hologram_expiry', 'Holograma'],
];

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  return `${day}/${m}/${y}`;
}

function VehicleCard({ vehicle }) {
  const meta = VEHICLE_STATUS_META[vehicle.status] || VEHICLE_STATUS_META.active;
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
          <Truck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">{vehicle.plate} {vehicle.unit_number && `· Unidad ${vehicle.unit_number}`}</p>
          <p className="text-sm text-muted-foreground truncate">
            {vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Odómetro</p>
          <p className="font-medium">{vehicle.odometer ? `${vehicle.odometer.toLocaleString()} km` : '—'}</p>
        </div>
        {EXPIRY_FIELDS.map(([field, label]) => (
          <div key={field}>
            <p className="text-muted-foreground">{label}</p>
            <p className="font-medium">{fmtDate(vehicle[field])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RentChargeRow({ charge, vehicle, graceDays }) {
  const status = isOverdue(charge, graceDays) ? 'overdue' : statusOf(charge);
  const meta = statusMeta[status];
  const balance = Math.max((charge.amount_due || 0) - (charge.amount_paid || 0), 0);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{vehicle?.plate || vehicle?.unit_number || '—'}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(charge.period_start)} – {fmtDate(charge.period_end)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">${(charge.amount_due || 0).toLocaleString()}</p>
        {balance > 0 && <p className="text-xs text-destructive">Debe ${balance.toLocaleString()}</p>}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.cls}`}>{meta.label}</span>
    </div>
  );
}

function MaintenanceRow({ record, vehicle }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{vehicle?.plate || vehicle?.unit_number || '—'} · {record.description || record.category}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(record.performed_at)}</p>
      </div>
      {record.cost != null && <p className="text-sm font-medium shrink-0">${Number(record.cost).toLocaleString()}</p>}
    </div>
  );
}

/**
 * Panel del socio/inversionista (/investor/home) — solo lectura, acotado del
 * lado del servidor (RLS de Vehicle/Maintenance/RentCharge por `owner_group_id`)
 * a las unidades de la sociedad de este usuario.
 */
export default function InvestorHome() {
  const { data: user, isLoading: meLoading } = useMe();
  const { tenant } = useTenant();
  const graceDays = getSetting(tenant, 'rent_grace_days');
  const groupId = user?.owner_group_id;
  const enabled = !!groupId;

  const { data: vehicles = [], isLoading: vehiclesLoading } = useEntityList('Vehicle', { filter: { owner_group_id: groupId }, enabled });
  const { data: maintenance = [] } = useEntityList('Maintenance', { filter: { owner_group_id: groupId }, sort: '-performed_at', limit: 50, enabled });
  const { data: rentCharges = [] } = useEntityList('RentCharge', { filter: { owner_group_id: groupId }, sort: '-period_start', limit: 50, enabled });

  const vehicleById = (id) => vehicles.find((v) => v.id === id);

  const loading = meLoading || vehiclesLoading;

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <PageHeader title="Mis unidades" subtitle="Panel del socio" />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  if (!groupId) {
    return (
      <div className="p-4">
        <PageHeader title="Mis unidades" subtitle="Panel del socio" />
        <EmptyState
          icon={Truck}
          title="Sin unidades asignadas todavía"
          description="Contacta al administrador de tu organización para que vincule tu cuenta a las unidades de tu sociedad."
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader title="Mis unidades" subtitle={`Vista de solo lectura · ${vehicles.length} unidad${vehicles.length === 1 ? '' : 'es'}`} />

      <section className="space-y-3">
        {vehicles.length === 0 ? (
          <EmptyState icon={Truck} title="No hay unidades vinculadas a tu grupo" />
        ) : (
          vehicles.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Banknote className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Pagos de renta del chofer</h2>
        </div>
        {rentCharges.length === 0 ? (
          <EmptyState icon={Banknote} title="Aún no hay cobros de renta registrados" />
        ) : (
          <div>
            {rentCharges.map((c) => (
              <RentChargeRow key={c.id} charge={c} vehicle={vehicleById(c.vehicle_id)} graceDays={graceDays} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Mantenimientos</h2>
        </div>
        {maintenance.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Aún no hay mantenimientos registrados" />
        ) : (
          <div>
            {maintenance.map((m) => (
              <MaintenanceRow key={m.id} record={m} vehicle={vehicleById(m.vehicle_id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
