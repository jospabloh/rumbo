import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, CheckCircle2, AlertCircle, Loader2, Users, Truck, Bell, Wrench } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';

export default function TestDataPage() {
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCreateTestData = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const tenantId = tenant.id;
      const vehicles = [];
      const drivers = [];

      const vehicleData = [
        { plate: 'TEST-001', make: 'Toyota', model: 'Corolla', year: 2022, odometer: 32000 },
        { plate: 'TEST-002', make: 'Nissan', model: 'Versa', year: 2021, odometer: 47500 },
        { plate: 'TEST-003', make: 'Honda', model: 'Civic', year: 2023, odometer: 18200 },
        { plate: 'TEST-004', make: 'Volkswagen', model: 'Jetta', year: 2020, odometer: 61000 },
        { plate: 'TEST-005', make: 'Mazda', model: '3', year: 2022, odometer: 25800 },
      ];

      for (const vData of vehicleData) {
        const vehicle = await base44.entities.Vehicle.create({ tenant_id: tenantId, ...vData, status: 'active' });
        vehicles.push(vehicle);
      }

      const driverData = [
        { full_name: 'Juan Pérez Test', license_no: 'LIC-001', phone: '55-1234-5678', rating: 4.8, license_expiry: '2026-06-10' },
        { full_name: 'María García Test', license_no: 'LIC-002', phone: '55-8765-4321', rating: 4.9, license_expiry: '2027-03-15' },
        { full_name: 'Carlos López Test', license_no: 'LIC-003', phone: '55-1111-2222', rating: 4.5, license_expiry: '2026-09-05' },
        { full_name: 'Ana Martínez Test', license_no: 'LIC-004', phone: '55-3333-4444', rating: 4.2, license_expiry: '2026-07-01' },
        { full_name: 'Roberto Sánchez Test', license_no: 'LIC-005', phone: '55-5555-6666', rating: 5.0, license_expiry: '2027-06-01' },
      ];

      for (const dData of driverData) {
        const driver = await base44.entities.Driver.create({ tenant_id: tenantId, ...dData, status: 'active', hire_date: '2024-01-15' });
        drivers.push(driver);
      }

      await base44.entities.Alert.create({ tenant_id: tenantId, entity_type: 'driver_doc', entity_id: drivers[0].id, driver_id: drivers[0].id, message: 'Licencia vence en 15 días', severity: 'warning', due_date: '2026-06-10', resolved: false });
      await base44.entities.Alert.create({ tenant_id: tenantId, entity_type: 'vehicle_doc', entity_id: vehicles[2].id, vehicle_id: vehicles[2].id, message: 'Seguro vencido - TEST-003', severity: 'critical', due_date: '2026-05-20', resolved: false });
      await base44.entities.Alert.create({ tenant_id: tenantId, entity_type: 'maintenance', entity_id: vehicles[0].id, vehicle_id: vehicles[0].id, message: 'Mantenimiento preventivo próximo', severity: 'info', due_date: '2026-10-10', resolved: false });

      await base44.entities.Maintenance.create({ tenant_id: tenantId, vehicle_id: vehicles[0].id, kind: 'preventive', description: 'Cambio de aceite y filtros', odometer: 15000, cost: 1200, performed_at: '2026-04-10', next_due_at: '2026-10-10' });
      await base44.entities.Maintenance.create({ tenant_id: tenantId, vehicle_id: vehicles[2].id, kind: 'corrective', description: 'Reparación de frenos delanteros', odometer: 18200, cost: 3500, performed_at: '2026-05-01' });

      await base44.entities.Fine.create({ tenant_id: tenantId, driver_id: drivers[0].id, vehicle_id: vehicles[0].id, fine_type: 'Exceso de velocidad', amount: 1500, points: 15, issued_at: '2026-04-10', paid: false });
      await base44.entities.Fine.create({ tenant_id: tenantId, driver_id: drivers[1].id, vehicle_id: vehicles[1].id, fine_type: 'Semáforo en rojo', amount: 2000, points: 20, issued_at: '2026-05-05', paid: true });

      await base44.entities.FuelLog.create({ tenant_id: tenantId, vehicle_id: vehicles[0].id, driver_id: drivers[0].id, liters: 45, price_per_liter: 22.5, total_cost: 1012.5, odometer: 31800, logged_at: '2026-05-20T10:30:00' });
      await base44.entities.FuelLog.create({ tenant_id: tenantId, vehicle_id: vehicles[1].id, driver_id: drivers[1].id, liters: 50, price_per_liter: 22.5, total_cost: 1125, odometer: 47200, logged_at: '2026-05-18T14:00:00' });

      await base44.entities.Trip.create({ tenant_id: tenantId, vehicle_id: vehicles[0].id, driver_id: drivers[0].id, platform: 'uber', started_at: '2026-05-20T08:00:00', ended_at: '2026-05-20T12:00:00', distance_km: 85.5, earnings: 450 });
      await base44.entities.Trip.create({ tenant_id: tenantId, vehicle_id: vehicles[1].id, driver_id: drivers[1].id, platform: 'didi', started_at: '2026-05-19T09:00:00', ended_at: '2026-05-19T13:30:00', distance_km: 62.3, earnings: 380 });
      await base44.entities.Trip.create({ tenant_id: tenantId, vehicle_id: vehicles[3].id, driver_id: drivers[2].id, platform: 'particular', started_at: '2026-05-18T07:00:00', ended_at: '2026-05-18T11:00:00', distance_km: 120, earnings: 600 });

      setResult({ success: true, summary: { vehicles: vehicles.length, drivers: drivers.length, alerts: 3, maintenance: 2, fines: 2, fuelLogs: 2, trips: 3 } });
    } catch (err) {
      setError(err.message || 'Error al crear datos de prueba');
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                No hay tenant configurado
              </CardTitle>
              <CardDescription>
                Necesitas crear un tenant antes de generar datos de prueba
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Los datos de prueba requieren un tenant existente. Si estás en modo TEST, 
                primero completa el onboarding o crea un tenant desde el panel de administración.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Generar Datos de Prueba</h1>
            <p className="text-muted-foreground mt-1">
              Tenant actual: <span className="text-primary font-medium">{tenant.tenant_name}</span>
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Generar datos de prueba
            </CardTitle>
            <CardDescription>
              Esta acción creará vehículos, conductores, alertas, mantenimientos, multas y viajes de prueba
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                <Truck className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">5 Vehículos</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">5 Conductores</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                <Bell className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">2 Alertas</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                <Wrench className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Mantenimientos, multas, viajes</span>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {result && (
              <div className="p-4 bg-success/10 border border-success/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <p className="text-sm font-medium text-success">Datos creados exitosamente</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{result.summary.vehicles}</p>
                    <p className="text-xs text-muted-foreground">Vehículos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{result.summary.drivers}</p>
                    <p className="text-xs text-muted-foreground">Conductores</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{result.summary.alerts}</p>
                    <p className="text-xs text-muted-foreground">Alertas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{result.summary.trips}</p>
                    <p className="text-xs text-muted-foreground">Viajes</p>
                  </div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleCreateTestData} 
              disabled={loading || !!result}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando datos...
                </>
              ) : result ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Datos creados
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Generar datos de prueba
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Los datos se crean en la base de datos TEST (entorno de pruebas)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}