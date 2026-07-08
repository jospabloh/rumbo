import { PiggyBank } from 'lucide-react';

/**
 * Fondo de mantenimiento: cuánto se ha "reservado" de la renta (a la tasa
 * semanal configurada en el vehículo) contra lo realmente gastado en
 * Maintenance en el rango activo de /reports. Solo se muestra si la unidad
 * tiene una reserva semanal configurada — la mayoría no la tendrán todavía.
 *
 * @param {{ vehicle: any }} props
 */
export default function MaintenanceFundCard({ vehicle }) {
  if (!vehicle.maintenance_reserve_weekly) return null;

  const reserved = vehicle.maintenance_fund_reserved || 0;
  const spent = vehicle.maintenance_cost || 0;
  const balance = vehicle.maintenance_fund_balance ?? (reserved - spent);

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <PiggyBank className="w-4 h-4 text-primary" />Fondo de mantenimiento
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Reserva semanal</p>
          <p className="text-sm font-bold font-mono">${Number(vehicle.maintenance_reserve_weekly).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Reservado en el rango</p>
          <p className="text-sm font-bold font-mono">${Math.round(reserved).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Gastado en mantenimiento</p>
          <p className="text-sm font-bold font-mono text-destructive">${Math.round(spent).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Saldo del fondo</p>
          <p className={`text-sm font-bold font-mono ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
            ${Math.round(balance).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
