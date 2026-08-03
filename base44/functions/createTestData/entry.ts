import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * createTestData — datos de demo para el tenant del app owner que la invoca
 * (nunca "adivina" un tenant ajeno: usa solo `user.data.tenant_id` ya resuelto).
 *
 * Incluye 5 semanas de RentCharge con pagos repartidos en varios días por
 * semana (no un solo pago) para que la matriz día×unidad de /reports muestre
 * variación real, unidades con distinto nivel de utilidad (incl. una por
 * debajo del rango de la flota), una unidad con la semana en curso pagada solo
 * parcialmente (para probar el traslado de saldo en Rentas), y Maintenance con
 * `category`/`kind` nuevos (`tires`, `major_repair`) para ejercitar el
 * pronóstico de llantas/mantenimiento.
 */

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lunes=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    if (!appOwnerEmail || (user.email || '').toLowerCase() !== appOwnerEmail) {
      return Response.json({ error: 'Forbidden: app owner only' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const tenantId = user.data?.tenant_id;
    if (!tenantId) {
      return Response.json({ error: 'No se encontró un tenant. Primero completa el onboarding.' }, { status: 400 });
    }

    const now = new Date();
    const thisMonday = mondayOf(now);

    const driverDefs = [
      { full_name: 'Juan Pérez Test', license_no: 'LIC-001', phone: '55-1234-5678', rating: 4.8, license_expiry: '2026-06-10' },
      { full_name: 'María García Test', license_no: 'LIC-002', phone: '55-8765-4321', rating: 4.9, license_expiry: '2027-03-15' },
      { full_name: 'Carlos López Test', license_no: 'LIC-003', phone: '55-1111-2222', rating: 4.5, license_expiry: '2026-09-05' },
      { full_name: 'Ana Martínez Test', license_no: 'LIC-004', phone: '55-3333-4444', rating: 4.2, license_expiry: '2026-07-01' },
      { full_name: 'Roberto Sánchez Test', license_no: 'LIC-005', phone: '55-5555-6666', rating: 5.0, license_expiry: '2027-06-01' },
      { full_name: 'Diego Ramírez Test', license_no: 'LIC-006', phone: '55-2222-3333', rating: 4.6, license_expiry: '2026-11-20' },
      { full_name: 'Laura Torres Test', license_no: 'LIC-007', phone: '55-4444-5555', rating: 3.9, license_expiry: '2026-08-12' },
      { full_name: 'Fernando Cruz Test', license_no: 'LIC-008', phone: '55-6666-7777', rating: 4.95, license_expiry: '2027-02-28' },
    ];
    const drivers = [];
    for (const d of driverDefs) {
      drivers.push(await svc.entities.Driver.create({ tenant_id: tenantId, ...d, status: 'active', hire_date: '2024-01-15' }));
    }

    // driverIndex: null = sin conductor asignado (unidades de baja). payFrac controla
    // qué tan bien le va a la unidad: pagos de renta como fracción de la renta base
    // (bajo payFrac ⇒ utilidad baja ⇒ candidata a "bajo rango de la flota").
    // fuelPriceMult escala el costo/L de combustible (unidades más viejas/caras de
    // operar consumen combustible más caro) para que el costo/km también varíe.
    const vehicleDefs = [
      { plate: 'TEST-001', make: 'Toyota', model: 'Corolla', year: 2022, odometer: 32000, status: 'active', driverIndex: 0, rent: 2900, payFrac: [1.0, 1.15], fuelPriceMult: 0.85 },
      { plate: 'TEST-002', make: 'Nissan', model: 'Versa', year: 2021, odometer: 47500, status: 'active', driverIndex: 1, rent: 2700, payFrac: [0.95, 1.05], fuelPriceMult: 0.95 },
      { plate: 'TEST-003', make: 'Honda', model: 'Civic', year: 2023, odometer: 18200, status: 'active', driverIndex: 2, rent: 2800, payFrac: [0.9, 1.0], fuelPriceMult: 1.0 },
      { plate: 'TEST-004', make: 'Volkswagen', model: 'Jetta', year: 2020, odometer: 61000, status: 'active', driverIndex: 3, rent: 2600, payFrac: [0.88, 1.0], fuelPriceMult: 1.1 },
      { plate: 'TEST-005', make: 'Mazda', model: '3', year: 2022, odometer: 25800, status: 'active', driverIndex: 4, rent: 2850, payFrac: [0.92, 1.02], fuelPriceMult: 0.9 },
      { plate: 'TEST-006', make: 'Chevrolet', model: 'Aveo', year: 2019, odometer: 72000, status: 'maintenance', driverIndex: null, rent: 2400, payFrac: [0, 0], fuelPriceMult: 1 },
      { plate: 'TEST-007', make: 'Nissan', model: 'March', year: 2018, odometer: 88000, status: 'active', driverIndex: 5, rent: 2500, payFrac: [0.4, 0.55], fuelPriceMult: 1.3 },
      { plate: 'TEST-008', make: 'Kia', model: 'Rio', year: 2019, odometer: 79500, status: 'active', driverIndex: 6, rent: 2500, payFrac: [0.45, 0.6], fuelPriceMult: 1.25 },
      { plate: 'TEST-009', make: 'Renault', model: 'Logan', year: 2018, odometer: 91000, status: 'inactive', driverIndex: null, rent: 2300, payFrac: [0, 0], fuelPriceMult: 1 },
      { plate: 'TEST-010', make: 'Hyundai', model: 'Accent', year: 2023, odometer: 12500, status: 'active', driverIndex: 7, rent: 3000, payFrac: [1.05, 1.2], fuelPriceMult: 0.8 },
    ];

    const vehicles = [];
    for (const v of vehicleDefs) {
      vehicles.push(await svc.entities.Vehicle.create({
        tenant_id: tenantId,
        plate: v.plate, make: v.make, model: v.model, year: v.year, odometer: v.odometer,
        status: v.status,
        assigned_driver_id: v.driverIndex != null ? drivers[v.driverIndex].id : undefined,
        rent_amount: v.rent, rent_frequency: 'weekly', rent_day: 'monday',
      }));
    }

    let rentChargeCount = 0, fuelLogCount = 0;
    const WEEKS_BACK = 5;

    for (let i = 0; i < vehicleDefs.length; i++) {
      const v = vehicleDefs[i];
      if (v.status !== 'active' || v.driverIndex == null) continue; // sin renta/combustible para unidades de baja
      const vehicle = vehicles[i];
      let odometer = v.odometer - 1800; // punto de partida ~5 semanas atrás

      for (let w = WEEKS_BACK - 1; w >= 0; w--) {
        const periodStart = addDays(thisMonday, -7 * w);
        const periodEnd = addDays(periodStart, 6);
        const isCurrentWeek = w === 0;

        // Pagos repartidos en 2-4 días distintos de la semana (nunca en el futuro).
        const targetTotal = v.rent * rand(v.payFrac[0], v.payFrac[1]);
        // La unidad TEST-007 deja su semana en curso solo parcialmente pagada a
        // propósito, para demostrar el traslado de saldo a la siguiente semana.
        const weekTotal = (isCurrentWeek && v.plate === 'TEST-007') ? v.rent * 0.35 : targetTotal;
        const nPayments = 2 + Math.floor(Math.random() * 3);
        const payments = [];
        let remaining = weekTotal;
        for (let p = 0; p < nPayments && remaining > 0; p++) {
          const dayOffset = Math.floor(rand(0, 6));
          const paidAt = addDays(periodStart, dayOffset);
          if (paidAt > now) continue;
          const amount = p === nPayments - 1 ? remaining : Math.round(remaining * rand(0.25, 0.6) * 100) / 100;
          payments.push({ amount, paid_at: iso(paidAt), method: pick(['efectivo', 'transferencia']), note: '' });
          remaining = Math.round((remaining - amount) * 100) / 100;
        }
        const amountPaid = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
        const status = amountPaid >= v.rent ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

        await svc.entities.RentCharge.create({
          tenant_id: tenantId, vehicle_id: vehicle.id, driver_id: drivers[v.driverIndex].id,
          period_type: 'weekly', period_start: iso(periodStart), period_end: iso(periodEnd),
          amount_due: v.rent, amount_paid: amountPaid, status, payments,
        });
        rentChargeCount++;

        // Combustible: 1-2 cargas por semana, con odómetro creciente y costo/L acorde
        // al perfil de la unidad (fuelPriceMult más alto ⇒ unidad más cara de operar).
        const fuelEvents = 1 + Math.floor(Math.random() * 2);
        for (let f = 0; f < fuelEvents; f++) {
          const dayOffset = Math.floor(rand(0, 6));
          const loggedAt = addDays(periodStart, dayOffset);
          if (loggedAt > now) continue;
          odometer += Math.round(rand(120, 260));
          const liters = Math.round(rand(30, 45));
          const pricePerLiter = (22 + rand(0, 2)) * v.fuelPriceMult;
          await svc.entities.FuelLog.create({
            tenant_id: tenantId, vehicle_id: vehicle.id, driver_id: drivers[v.driverIndex].id,
            liters, price_per_liter: Math.round(pricePerLiter * 100) / 100,
            total_cost: Math.round(liters * pricePerLiter * 100) / 100,
            odometer, logged_at: `${iso(loggedAt)}T${String(8 + f * 6).padStart(2, '0')}:00:00`,
          });
          fuelLogCount++;
        }
      }
    }

    // Mantenimiento — ejercita kind (incl. major_repair) y category (incl. tires).
    const maintenanceEvents = [
      { v: 0, kind: 'preventive', category: 'general', description: 'Cambio de aceite y filtros', cost: 1200, daysAgo: 25 },
      { v: 0, kind: 'preventive', category: 'tires', description: 'Rotación y balanceo de llantas', cost: 2800, daysAgo: 60 },
      { v: 2, kind: 'corrective', category: 'brakes', description: 'Reparación de frenos delanteros', cost: 3500, daysAgo: 10 },
      { v: 5, kind: 'major_repair', category: 'engine', description: 'Reconstrucción de motor — unidad en taller', cost: 18500, odometerOverride: vehicleDefs[5].odometer, daysAgo: 3, nextDueAt: 90 },
      { v: 6, kind: 'corrective', category: 'electrical', description: 'Falla en sistema eléctrico', cost: 2100, daysAgo: 8 },
      { v: 9, kind: 'preventive', category: 'tires', description: 'Cambio de llantas delanteras', cost: 4200, daysAgo: 15, odometerOverride: 9500 },
      { v: 9, kind: 'preventive', category: 'tires', description: 'Cambio de llantas (anterior)', cost: 4000, daysAgo: 200, odometerOverride: 3000 },
    ];
    for (const m of maintenanceEvents) {
      const vehicle = vehicles[m.v];
      const performedAt = iso(addDays(now, -m.daysAgo));
      const odometer = m.odometerOverride ?? vehicleDefs[m.v].odometer;
      await svc.entities.Maintenance.create({
        tenant_id: tenantId, vehicle_id: vehicle.id, kind: m.kind, category: m.category,
        description: m.description, odometer, cost: m.cost, performed_at: performedAt,
        next_due_at: m.nextDueAt ? iso(addDays(now, m.nextDueAt)) : undefined,
      });
    }

    await svc.entities.Alert.create({ tenant_id: tenantId, entity_type: 'driver_doc', entity_id: drivers[3].id, driver_id: drivers[3].id, message: 'Certificado médico vence en 20 días', severity: 'warning', due_date: '2026-06-15', resolved: false });
    await svc.entities.Alert.create({ tenant_id: tenantId, entity_type: 'vehicle_doc', entity_id: vehicles[2].id, vehicle_id: vehicles[2].id, message: 'Seguro vencido - TEST-003', severity: 'critical', due_date: '2026-05-20', resolved: false });
    await svc.entities.Alert.create({ tenant_id: tenantId, entity_type: 'driver_doc', entity_id: drivers[0].id, driver_id: drivers[0].id, message: 'Licencia vence en 15 días - Juan Pérez', severity: 'warning', due_date: '2026-06-10', resolved: false });

    await svc.entities.Fine.create({ tenant_id: tenantId, driver_id: drivers[0].id, vehicle_id: vehicles[0].id, fine_type: 'Exceso de velocidad', amount: 1500, points: 15, issued_at: iso(addDays(now, -20)), paid: false });
    await svc.entities.Fine.create({ tenant_id: tenantId, driver_id: drivers[6].id, vehicle_id: vehicles[7].id, fine_type: 'Semáforo en rojo', amount: 2000, points: 20, issued_at: iso(addDays(now, -5)), paid: true });

    await svc.entities.Trip.create({ tenant_id: tenantId, vehicle_id: vehicles[0].id, driver_id: drivers[0].id, platform: 'uber', started_at: `${iso(addDays(now, -2))}T08:00:00`, ended_at: `${iso(addDays(now, -2))}T12:00:00`, distance_km: 85.5, earnings: 450 });

    return Response.json({
      success: true,
      message: 'Datos de prueba creados exitosamente',
      summary: {
        vehicles: vehicles.length,
        drivers: drivers.length,
        rentCharges: rentChargeCount,
        fuelLogs: fuelLogCount,
        maintenance: maintenanceEvents.length,
        alerts: 3,
        fines: 2,
        trips: 1,
      },
      tenant_id: tenantId,
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
