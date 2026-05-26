import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - today) / (1000 * 60 * 60 * 24));
}

function getSeverity(days) {
  if (days === null) return null;
  if (days <= 3) return 'critical';
  if (days <= 15) return 'warning';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'owner' && user.role !== 'dispatcher')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [drivers, driverDocs, vehicles, vehicleDocs, maintenanceRecords, existingAlerts] = await Promise.all([
      base44.asServiceRole.entities.Driver.list(),
      base44.asServiceRole.entities.DriverDocument.list(),
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.VehicleDocument.list(),
      base44.asServiceRole.entities.Maintenance.list(),
      base44.asServiceRole.entities.Alert.filter({ resolved: false }),
    ]);

    const created = [];

    const alertExists = (entityType, entityId) =>
      existingAlerts.some(a => a.entity_type === entityType && a.entity_id === entityId);

    // Driver document expiries
    for (const doc of driverDocs) {
      const days = daysUntil(doc.expires_at);
      const severity = getSeverity(days);
      if (severity && !alertExists('driver_doc', doc.id)) {
        const driver = drivers.find(d => d.id === doc.driver_id);
        await base44.asServiceRole.entities.Alert.create({
          entity_type: 'driver_doc',
          entity_id: doc.id,
          driver_id: doc.driver_id,
          message: `Documento ${doc.doc_type} de ${driver?.full_name || 'conductor'} vence en ${days <= 0 ? 'venció' : `${days} día(s)`}`,
          severity,
          due_date: doc.expires_at,
          resolved: false,
        });
        created.push(`driver_doc:${doc.id}`);
      }
    }

    // Driver license and medical cert
    for (const driver of drivers) {
      for (const [field, label] of [['license_expiry', 'Licencia'], ['medical_cert_expiry', 'Cert. médico']]) {
        const days = daysUntil(driver[field]);
        const severity = getSeverity(days);
        if (severity && !alertExists('driver_doc', `${driver.id}_${field}`)) {
          await base44.asServiceRole.entities.Alert.create({
            entity_type: 'driver_doc',
            entity_id: `${driver.id}_${field}`,
            driver_id: driver.id,
            message: `${label} de ${driver.full_name} ${days <= 0 ? 'vencida' : `vence en ${days} día(s)`}`,
            severity,
            due_date: driver[field],
            resolved: false,
          });
          created.push(`driver_${field}:${driver.id}`);
        }
      }
    }

    // Vehicle expiries
    for (const vehicle of vehicles) {
      for (const [field, label] of [
        ['insurance_expiry', 'Seguro'],
        ['inspection_expiry', 'Inspección'],
        ['registration_expiry', 'Registro'],
      ]) {
        const days = daysUntil(vehicle[field]);
        const severity = getSeverity(days);
        if (severity && !alertExists('vehicle_doc', `${vehicle.id}_${field}`)) {
          await base44.asServiceRole.entities.Alert.create({
            entity_type: 'vehicle_doc',
            entity_id: `${vehicle.id}_${field}`,
            vehicle_id: vehicle.id,
            message: `${label} del vehículo ${vehicle.plate} ${days <= 0 ? 'venció' : `vence en ${days} día(s)`}`,
            severity,
            due_date: vehicle[field],
            resolved: false,
          });
          created.push(`vehicle_${field}:${vehicle.id}`);
        }
      }
    }

    // Vehicle document expiries
    for (const doc of vehicleDocs) {
      const days = daysUntil(doc.expires_at);
      const severity = getSeverity(days);
      if (severity && !alertExists('vehicle_doc', doc.id)) {
        const vehicle = vehicles.find(v => v.id === doc.vehicle_id);
        await base44.asServiceRole.entities.Alert.create({
          entity_type: 'vehicle_doc',
          entity_id: doc.id,
          vehicle_id: doc.vehicle_id,
          message: `Documento ${doc.doc_type} del vehículo ${vehicle?.plate || ''} ${days <= 0 ? 'venció' : `vence en ${days} día(s)`}`,
          severity,
          due_date: doc.expires_at,
          resolved: false,
        });
        created.push(`vehicle_doc:${doc.id}`);
      }
    }

    // Maintenance next_due_at
    for (const m of maintenanceRecords) {
      if (!m.next_due_at) continue;
      const days = daysUntil(m.next_due_at);
      const severity = getSeverity(days);
      if (severity && !alertExists('maintenance', m.id)) {
        const vehicle = vehicles.find(v => v.id === m.vehicle_id);
        await base44.asServiceRole.entities.Alert.create({
          entity_type: 'maintenance',
          entity_id: m.id,
          vehicle_id: m.vehicle_id,
          message: `Mantenimiento de ${vehicle?.plate || 'vehículo'} ${days <= 0 ? 'venció' : `programado en ${days} día(s)`}`,
          severity,
          due_date: m.next_due_at,
          resolved: false,
        });
        created.push(`maintenance:${m.id}`);
      }
    }

    return Response.json({ created: created.length, items: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});