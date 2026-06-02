import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    // Fetch data filtered by tenant_id
    const [vehicles, fuelLogs, maintenanceRecords, fines] = await Promise.all([
      base44.entities.Vehicle.filter({ tenant_id: tenantId }),
      base44.entities.FuelLog.filter({ tenant_id: tenantId }),
      base44.entities.Maintenance.filter({ tenant_id: tenantId }),
      base44.entities.Fine.filter({ tenant_id: tenantId }),
    ]);

    const results = vehicles.map(vehicle => {
      const vFuel = fuelLogs.filter(l => l.vehicle_id === vehicle.id);
      const vMaint = maintenanceRecords.filter(m => m.vehicle_id === vehicle.id);
      const vFines = fines.filter(f => f.vehicle_id === vehicle.id);

      const fuelCost = vFuel.reduce((s, l) => s + (parseFloat(l.total_cost) || 0), 0);
      const maintenanceCost = vMaint.reduce((s, m) => s + (parseFloat(m.cost) || 0), 0);
      const finesCost = vFines.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
      const totalCost = fuelCost + maintenanceCost + finesCost;

      // Calculate km from odometer readings in fuel logs
      const odometerReadings = vFuel.map(l => l.odometer).filter(Boolean).sort((a, b) => a - b);
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
      };
    }).filter(r => r.km_traveled && r.km_traveled > 0);

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});