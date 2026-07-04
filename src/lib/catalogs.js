import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';

/**
 * Catálogos configurables por el admin del tenant.
 * La app consume estos valores en sus dropdowns. Si el tenant no ha definido un
 * catálogo, se usan los valores por defecto (semilla) para que la app funcione,
 * y el admin puede sobrescribirlos desde la sección Catálogos.
 */
export const CATALOG_CATEGORIES = [
  { key: 'fine_type', label: 'Tipos de infracción', defaults: ['Exceso de velocidad', 'Semáforo en rojo', 'Estacionamiento indebido', 'Documentos vencidos', 'Otro'] },
  { key: 'payment_method', label: 'Métodos de pago', defaults: ['Efectivo', 'Transferencia', 'Depósito', 'Otro'] },
  { key: 'vehicle_make', label: 'Marcas de vehículo', defaults: ['Nissan', 'Renault', 'Chevrolet', 'Toyota', 'Volkswagen', 'Honda', 'Mazda'] },
  { key: 'maintenance_type', label: 'Tipos de servicio (taller)', defaults: ['Cambio de aceite', 'Afinación', 'Frenos', 'Llantas', 'Suspensión', 'Alineación y balanceo', 'Batería', 'Verificación', 'Otro'] },
  { key: 'insurance_company', label: 'Aseguradoras', defaults: ['GNP', 'Qualitas', 'AXA', 'Chubb', 'Mapfre', 'HDI', 'Otra'] },
];

export const defaultsFor = (category) => CATALOG_CATEGORIES.find((c) => c.key === category)?.defaults || [];

const sortItems = (rows) =>
  rows.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.label || '').localeCompare(b.label || ''));

/**
 * Devuelve las etiquetas activas del catálogo (o los defaults si no hay ninguno).
 */
export function useCatalog(category) {
  const { tenantId } = useTenant();
  const [items, setItems] = useState(defaultsFor(category));

  useEffect(() => {
    let alive = true;
    if (!tenantId) { setItems(defaultsFor(category)); return; }
    base44.entities.Catalog.filter({ tenant_id: tenantId, category, active: true })
      .then((rows) => {
        if (!alive) return;
        setItems(rows && rows.length ? sortItems(rows).map((r) => r.label) : defaultsFor(category));
      })
      .catch(() => { if (alive) setItems(defaultsFor(category)); });
    return () => { alive = false; };
  }, [tenantId, category]);

  return items;
}
