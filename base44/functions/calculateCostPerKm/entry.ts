import { createClientFromRequest } from 'npm:@base44/sdk@0.8.37';

/**
 * calculateCostPerKm — costo por kilómetro por vehículo.
 *
 * Correctitud: el numerador (gastos) y el denominador (km) se toman de la MISMA ventana
 * temporal (cost_per_km_window_days, configurable por el tenant; default 90 días). Antes
 * se sumaban gastos de todo el historial pero los km salían solo del rango de odómetros de
 * los fuel logs, dando cifras absurdas (p. ej. $5000 de multas / 100 km = $50/km).
 */

const DEFAULT_WINDOW_DAYS = 90;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'dispatcher'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Owner, Admin or Dispatcher access required' }, { status: 403 });
    }

    const tenantId = user.data?.tenant_id;
    if (!tenantId) return Response.json({ error: 'No tenant asociado' }, { status: 403 });

    // Ventana configurable del tenant (Configuración del negocio); default si no la personalizó.
    let windowDays = DEFAULT_WINDOW_DAYS;
    try {
      const lic = await base44.asServiceRole.entities.TenantLicense.get(tenantId);
      const w = Number(lic?.settings?.cost_per_km_window_days);
      if (Number.isFinite(w) && w > 0) windowDays = w;
    } catch (_e) { /* usa el default */ }

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - windowDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    // Un registro entra en la ventana si su fecha (YYYY-MM-DD, comparable como texto) >= cutoff.
    const inWindow = (dateStr: unknown): boolean => {
      if (!dateStr) return false;
      return String(dateStr).slice(0, 10) >= cutoffStr;
    };

    const [vehicles, fuelLogs, maintenanceRecords, fines] = await Promise.all([
      base44.entities.Vehicle.filter({ tenant_id: tenantId }),
      base44.entities.FuelLog.filter({ tenant_id: tenantId }),
      base44.entities.Maintenance.filter({ tenant_id: tenantId }),
      base44.entities.Fine.filter({ tenant_id: tenantId }),
    ]);

    const results = vehicles.map((vehicle) => {
      // Todo dentro de la misma ventana temporal.
      const vFuel = fuelLogs.filter((l) => l.vehicle_id === vehicle.id && inWindow(l.logged_at));
      const vMaint = maintenanceRecords.filter((m) => m.vehicle_id === vehicle.id && inWindow(m.performed_at));
      const vFines = fines.filter((f) => f.vehicle_id === vehicle.id && inWindow(f.issued_at));

      const fuelCost = vFuel.reduce((s, l) => s + (parseFloat(l.total_cost) || 0), 0);
      const maintenanceCost = vMaint.reduce((s, m) => s + (parseFloat(m.cost) || 0), 0);
      const finesCost = vFines.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
      const totalCost = fuelCost + maintenanceCost + finesCost;

      // km recorridos en la ventana = rango de odómetros de los fuel logs de la ventana.
      const odometerReadings = vFuel.map((l) => l.odometer).filter(Boolean).sort((a, b) => a - b);
      const kmTraveled = odometerReadings.length >= 2
        ? odometerReadings[odometerReadings.length - 1] - odometerReadings[0]
        : null;

      const costPerKm = kmTraveled && kmTraveled > 0 ? totalCost / kmTraveled : null;

      return {
        vehicle_id: vehicle.id,
        plate: vehicle.plate,
        make: vehicle.make,
        model: vehicle.model,
        fuel_cost: fuelCost,
        maintenance_cost: maintenanceCost,
        fines_cost: finesCost,
        total_cost: totalCost,
        km_traveled: kmTraveled,
        cost_per_km: costPerKm,
        window_days: windowDays,
      };
    }).filter((r) => r.km_traveled && r.km_traveled > 0);

    return Response.json({ results, window_days: windowDays });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
