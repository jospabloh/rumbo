import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return Response.json({ error: 'Unauthorized: Admin or Owner access required' }, { status: 403 });
    }

    // Intentar obtener tenant del usuario en production
    let tenantId = user.data?.tenant_id;
    let base44Client = base44;
    let isDev = false;

    // Si no hay tenant en production, buscar en dev (test database)
    if (!tenantId) {
      isDev = true;
      base44Client = createClientFromRequest(req, { dataEnv: 'dev' });
      
      // Buscar tenant por owner_email y creado por este usuario
      const tenants = await base44Client.entities.TenantLicense.filter({ 
        $and: [{ owner_email: user.email }, { created_by_id: user.id }] 
      });
      if (!tenants || tenants.length === 0) {
        return Response.json({ 
          error: 'No tienes un tenant asociado. Primero crea un tenant desde el onboarding.',
        }, { status: 400 });
      }
      tenantId = tenants[0].id;
      console.log(`Tenant encontrado: ${tenantId}`);
    }

    console.log(`Creando datos de prueba para tenant: ${tenantId} (env: ${isDev ? 'dev' : 'prod'})`);

    // Usar service role para bypass del RLS
    const base44Service = isDev 
      ? createClientFromRequest(req, { dataEnv: 'dev', serviceRole: true })
      : createClientFromRequest(req, { serviceRole: true });

    const testData = {
      vehicles: [],
      drivers: [],
      summary: {},
    };

    // Datos base para vehículos y conductores
    const vehicleData = [
      { plate: 'TEST-001', make: 'Toyota', model: 'Corolla', year: 2022 },
      { plate: 'TEST-002', make: 'Nissan', model: 'Versa', year: 2021 },
      { plate: 'TEST-003', make: 'Honda', model: 'Civic', year: 2023 },
      { plate: 'TEST-004', make: 'Volkswagen', model: 'Jetta', year: 2020 },
      { plate: 'TEST-005', make: 'Mazda', model: '3', year: 2022 },
    ];

    const driverData = [
      { full_name: 'Juan Pérez Test', license_no: 'LIC-001', phone: '55-1234-5678', rating: 4.8 },
      { full_name: 'María García Test', license_no: 'LIC-002', phone: '55-8765-4321', rating: 4.9 },
      { full_name: 'Carlos López Test', license_no: 'LIC-003', phone: '55-1111-2222', rating: 4.5 },
      { full_name: 'Ana Martínez Test', license_no: 'LIC-004', phone: '55-3333-4444', rating: 4.2 },
      { full_name: 'Roberto Sánchez Test', license_no: 'LIC-005', phone: '55-5555-6666', rating: 5.0 },
    ];

    console.log('Creando vehículos...');
    for (const vData of vehicleData) {
      const vehicle = await base44Client.entities.Vehicle.create({
        tenant_id: tenantId,
        ...vData,
        status: 'active',
        odometer: Math.floor(Math.random() * 50000) + 5000,
      });
      testData.vehicles.push(vehicle);
    }

    console.log('Creando conductores...');
    for (const dData of driverData) {
      const driver = await base44Client.entities.Driver.create({
        tenant_id: tenantId,
        ...dData,
        status: 'active',
        hire_date: '2024-01-15',
      });
      testData.drivers.push(driver);
    }

    console.log('Creando alertas, mantenimientos, multas, combustible y viajes...');
    
    // Crear alertas
    await base44Client.entities.Alert.create({
      tenant_id: tenantId,
      entity_type: 'driver_doc',
      entity_id: testData.drivers[4].id,
      message: 'Licencia vence en 15 días',
      severity: 'warning',
      due_date: '2025-06-10',
      resolved: false,
    });

    await base44Client.entities.Alert.create({
      tenant_id: tenantId,
      entity_type: 'vehicle_doc',
      entity_id: testData.vehicles[4].id,
      message: 'Seguro vencido',
      severity: 'critical',
      due_date: '2025-05-20',
      resolved: false,
    });

    // Crear mantenimiento
    await base44Client.entities.Maintenance.create({
      tenant_id: tenantId,
      vehicle_id: testData.vehicles[0].id,
      kind: 'preventive',
      description: 'Cambio de aceite y filtros',
      odometer: 15000,
      cost: 1200,
      performed_at: '2025-05-10',
    });

    // Crear multa
    await base44Client.entities.Fine.create({
      tenant_id: tenantId,
      driver_id: testData.drivers[0].id,
      vehicle_id: testData.vehicles[0].id,
      fine_type: 'Exceso de velocidad',
      amount: 1500,
      points: 15,
      issued_at: '2025-05-10',
      paid: false,
    });

    // Crear log de combustible
    await base44Client.entities.FuelLog.create({
      tenant_id: tenantId,
      vehicle_id: testData.vehicles[0].id,
      driver_id: testData.drivers[0].id,
      liters: 45,
      price_per_liter: 22.5,
      total_cost: 1012.5,
      odometer: 14500,
      logged_at: '2025-05-20T10:30:00',
    });

    // Crear viaje
    await base44Client.entities.Trip.create({
      tenant_id: tenantId,
      vehicle_id: testData.vehicles[0].id,
      driver_id: testData.drivers[0].id,
      platform: 'uber',
      started_at: '2025-05-20T08:00:00',
      ended_at: '2025-05-20T12:00:00',
      distance_km: 85.5,
      earnings: 450,
    });

    return Response.json({
      success: true,
      message: 'Datos de prueba creados exitosamente',
      summary: {
        vehicles: testData.vehicles.length,
        drivers: testData.drivers.length,
        alerts: 2,
        maintenance: 1,
        fines: 1,
        fuelLogs: 1,
        trips: 1,
      },
      tenant_id: tenantId,
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});