import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function severity(days) {
  if (days <= 3) return 'critical';
  if (days <= 15) return 'warning';
  return 'info';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const [drivers, vehicles, driverDocs, vehicleDocs, maintenance, existingAlerts] = await Promise.all([
      base44.asServiceRole.entities.Driver.list(),
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.DriverDocument.list(),
      base44.asServiceRole.entities.VehicleDocument.list(),
      base44.asServiceRole.entities.Maintenance.filter({ next_due_at: { $exists: true } }),
      base44.asServiceRole.entities.Alert.filter({ resolved: false }),
    ]);

    const existingKeys = new Set(existingAlerts.map(a => `${a.entity_type}:${a.entity_id}`));
    const toCreate = [];

    // Driver license + medical expiry
    for (const d of drivers) {
      for (const [field, label] of [['license_expiry', 'Licencia'], ['medical_cert_expiry', 'Cert. médico']]) {
        const days = daysUntil(d[field]);
        if (days !== null && days <= 30) {
          const key = `driver_doc:${d.id}-${field}`;
          if (!existingAlerts.some(a => a.entity_id === `${d.id}-${field}` && a.entity_type === 'driver_doc')) {
            toCreate.push({
              entity_type: 'driver_doc', entity_id: `${d.id}-${field}`,
              driver_id: d.id,
              message: `${label} de ${d.full_name} vence en ${days} día${days === 1 ? '' : 's'}`,
              severity: severity(days), due_date: d[field], resolved: false,
            });
          }
        }
      }
    }

    // Driver documents
    for (const doc of driverDocs) {
      const days = daysUntil(doc.expires_at);
      if (days !== null && days <= 30) {
        if (!existingAlerts.some(a => a.entity_id === doc.id && a.entity_type === 'driver_doc')) {
          const driver = drivers.find(d => d.id === doc.driver_id);
          toCreate.push({
            entity_type: 'driver_doc', entity_id: doc.id,
            driver_id: doc.driver_id,
            message: `Documento (${doc.doc_type}) de ${driver?.full_name || 'conductor'} vence en ${days} día${days === 1 ? '' : 's'}`,
            severity: severity(days), due_date: doc.expires_at, resolved: false,
          });
        }
      }
    }

    // Vehicle insurance, inspection, registration
    for (const v of vehicles) {
      for (const [field, label] of [
        ['insurance_expiry', 'Seguro'], ['inspection_expiry', 'Inspección'], ['registration_expiry', 'Registro'],
      ]) {
        const days = daysUntil(v[field]);
        if (days !== null && days <= 30) {
          if (!existingAlerts.some(a => a.entity_id === `${v.id}-${field}` && a.entity_type === 'vehicle_doc')) {
            toCreate.push({
              entity_type: 'vehicle_doc', entity_id: `${v.id}-${field}`,
              vehicle_id: v.id,
              message: `${label} de vehículo ${v.plate} vence en ${days} día${days === 1 ? '' : 's'}`,
              severity: severity(days), due_date: v[field], resolved: false,
            });
          }
        }
      }
    }

    // Vehicle documents
    for (const doc of vehicleDocs) {
      const days = daysUntil(doc.expires_at);
      if (days !== null && days <= 30) {
        if (!existingAlerts.some(a => a.entity_id === doc.id && a.entity_type === 'vehicle_doc')) {
          const vehicle = vehicles.find(v => v.id === doc.vehicle_id);
          toCreate.push({
            entity_type: 'vehicle_doc', entity_id: doc.id,
            vehicle_id: doc.vehicle_id,
            message: `Documento (${doc.doc_type}) de ${vehicle?.plate || 'vehículo'} vence en ${days} día${days === 1 ? '' : 's'}`,
            severity: severity(days), due_date: doc.expires_at, resolved: false,
          });
        }
      }
    }

    // Maintenance due
    for (const m of maintenance) {
      const days = daysUntil(m.next_due_at);
      if (days !== null && days <= 14) {
        if (!existingAlerts.some(a => a.entity_id === m.id && a.entity_type === 'maintenance')) {
          const vehicle = vehicles.find(v => v.id === m.vehicle_id);
          toCreate.push({
            entity_type: 'maintenance', entity_id: m.id,
            vehicle_id: m.vehicle_id,
            message: `Mantenimiento de ${vehicle?.plate || 'vehículo'} vence en ${days} día${days === 1 ? '' : 's'}`,
            severity: severity(days), due_date: m.next_due_at, resolved: false,
          });
        }
      }
    }

    for (const alert of toCreate) {
      await base44.asServiceRole.entities.Alert.create(alert);
    }

    return Response.json({ created: toCreate.length, message: `${toCreate.length} alertas generadas` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});