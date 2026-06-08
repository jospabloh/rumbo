import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return Response.json({ error: 'Unauthorized: Admin or Owner access required' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // Buscar el tenant del usuario
    let tenantId = user.data?.tenant_id;

    if (!tenantId) {
      const tenants = await svc.entities.TenantLicense.list('-created_date', 50);
      const found = tenants.find(t => t.created_by_id === user.id)
        || tenants.find(t => t.owner_email === user.email)
        || tenants[0];
      tenantId = found?.id;
    }

    if (!tenantId) {
      return Response.json({
        error: 'No se encontró un tenant. Primero completa el onboarding.',
      }, { status: 400 });
    }

    const testData = { vehicles: [], drivers: [] };

    const vehicleData = [
      { plate: 'TEST-001', make: 'Toyota', model: 'Corolla', year: 2022, odometer: 32000 },
      { plate: 'TEST-002', make: 'Nissan', model: 'Versa', year: 2021, odometer: 47500 },
      { plate: 'TEST-003', make: 'Honda', model: 'Civic', year: 2023, odometer: 18200 },
      { plate: 'TEST-004', make: 'Volkswagen', model: 'Jetta', year: 2020, odometer: 61000 },
      { plate: 'TEST-005', make: 'Mazda', model: '3', year: 2022, odometer: 25800 },
    ];

    for (const vData of vehicleData) {
      const vehicle = await svc.entities.Vehicle.create({
        tenant_id: tenantId,
        ...vData,
        status: 'active',
      });
      testData.vehicles.push(vehicle);
    }

    const driverData = [
      { full_name: 'Juan Pérez Test', license_no: 'LIC-001', phone: '55-1234-5678', rating: 4.8, license_expiry: '2026-06-10', medical_cert_expiry: '2026-08-20' },
      { full_name: 'María García Test', license_no: 'LIC-002', phone: '55-8765-4321', rating: 4.9, license_expiry: '2027-03-15', medical_cert_expiry: '2026-11-10' },
      { full_name: 'Carlos López Test', license_no: 'LIC-003', phone: '55-1111-2222', rating: 4.5, license_expiry: '2026-09-05', medical_cert_expiry: '2027-01-15' },
      { full_name: 'Ana Martínez Test', license_no: 'LIC-004', phone: '55-3333-4444', rating: 4.2, license_expiry: '2026-07-01', medical_cert_expiry: '2026-06-15' },
      { full_name: 'Roberto Sánchez Test', license_no: 'LIC-005', phone: '55-5555-6666', rating: 5.0, license_expiry: '2027-06-01', medical_cert_expiry: '2027-06-01' },
    ];

    for (const dData of driverData) {
      const driver = await svc.entities.Driver.create({
        tenant_id: tenantId,
        ...dData,
        status: 'active',
        hire_date: '2024-01-15',
      });
      testData.drivers.push(driver);
    }

    await svc.entities.Alert.create({ tenant_id: tenantId, entity_type: 'driver_doc', entity_id: testData.drivers[3].id, driver_id: testData.drivers[3].id, message: 'Certificado médico vence en 20 días', severity: 'warning', due_date: '2026-06-15', resolved: false });
    await svc.entities.Alert.create({ tenant_id: tenantId, entity_type: 'vehicle_doc', entity_id: testData.vehicles[2].id, vehicle_id: testData.vehicles[2].id, message: 'Seguro vencido - TEST-003', severity: 'critical', due_date: '2026-05-20', resolved: false });
    await svc.entities.Alert.create({ tenant_id: tenantId, entity_type: 'driver_doc', entity_id: testData.drivers[0].id, driver_id: testData.drivers[0].id, message: 'Licencia vence en 15 días - Juan Pérez', severity: 'warning', due_date: '2026-06-10', resolved: false });

    await svc.entities.Maintenance.create({ tenant_id: tenantId, vehicle_id: testData.vehicles[0].id, kind: 'preventive', description: 'Cambio de aceite y filtros', odometer: 15000, cost: 1200, performed_at: '2026-04-10', next_due_at: '2026-10-10' });
    await svc.entities.Maintenance.create({ tenant_id: tenantId, vehicle_id: testData.vehicles[2].id, kind: 'corrective', description: 'Reparación de frenos delanteros', odometer: 18200, cost: 3500, performed_at: '2026-05-01' });

    await svc.entities.Fine.create({ tenant_id: tenantId, driver_id: testData.drivers[0].id, vehicle_id: testData.vehicles[0].id, fine_type: 'Exceso de velocidad', amount: 1500, points: 15, issued_at: '2026-04-10', paid: false });
    await svc.entities.Fine.create({ tenant_id: tenantId, driver_id: testData.drivers[1].id, vehicle_id: testData.vehicles[1].id, fine_type: 'Semáforo en rojo', amount: 2000, points: 20, issued_at: '2026-05-05', paid: true });

    await svc.entities.FuelLog.create({ tenant_id: tenantId, vehicle_id: testData.vehicles[0].id, driver_id: testData.drivers[0].id, liters: 45, price_per_liter: 22.5, total_cost: 1012.5, odometer: 31800, logged_at: '2026-05-20T10:30:00' });
    await svc.entities.FuelLog.create({ tenant_id: tenantId, vehicle_id: testData.vehicles[1].id, driver_id: testData.drivers[1].id, liters: 50, price_per_liter: 22.5, total_cost: 1125, odometer: 47200, logged_at: '2026-05-18T14:00:00' });

    await svc.entities.Trip.create({ tenant_id: tenantId, vehicle_id: testData.vehicles[0].id, driver_id: testData.drivers[0].id, platform: 'uber', started_at: '2026-05-20T08:00:00', ended_at: '2026-05-20T12:00:00', distance_km: 85.5, earnings: 450 });
    await svc.entities.Trip.create({ tenant_id: tenantId, vehicle_id: testData.vehicles[1].id, driver_id: testData.drivers[1].id, platform: 'didi', started_at: '2026-05-19T09:00:00', ended_at: '2026-05-19T13:30:00', distance_km: 62.3, earnings: 380 });
    await svc.entities.Trip.create({ tenant_id: tenantId, vehicle_id: testData.vehicles[3].id, driver_id: testData.drivers[2].id, platform: 'particular', started_at: '2026-05-18T07:00:00', ended_at: '2026-05-18T11:00:00', distance_km: 120, earnings: 600 });

    return Response.json({
      success: true,
      message: 'Datos de prueba creados exitosamente',
      summary: {
        vehicles: testData.vehicles.length,
        drivers: testData.drivers.length,
        alerts: 3,
        maintenance: 2,
        fines: 2,
        fuelLogs: 2,
        trips: 3,
      },
      tenant_id: tenantId,
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});