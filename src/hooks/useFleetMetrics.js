import { useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { useEntityList, useInvalidateEntity } from '@/hooks/useEntities';

/**
 * Utilidad/ranking/pronóstico de flota para /reports. Envuelve la función de
 * servidor `fleetUnitMetrics` con React Query en vez de un `useState` manual
 * (como hace CostPerKm.jsx) porque aquí el rango y la selección de unidades
 * cambian mucho más seguido que un cálculo "on demand" de un solo botón.
 *
 * `placeholderData: keepPreviousData` es necesario porque `vehicleIds`/`range`
 * son parte del queryKey: sin esto, cada toggle de "unidades visibles" o
 * cambio de rango cuenta como una query NUEVA (sin datos aún) y la página
 * entera se desmonta a un skeleton mientras llega la respuesta — lo que además
 * resetea el scroll a 0. Con `keepPreviousData` se sigue mostrando el
 * resultado anterior (stale) hasta que llega el nuevo, sin desmontar nada.
 *
 * @param {{ type: string, start: string, end: string }} range
 * @param {string[]|null} vehicleIds  Unidades visibles (null = todas).
 * @param {{ trailingPeriods?: number }} [opts]
 */
export function useFleetUnitMetrics(range, vehicleIds, { trailingPeriods = 4 } = {}) {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: ['fleetUnitMetrics', tenantId, range?.start, range?.end, vehicleIds, trailingPeriods],
    queryFn: async () => {
      const res = await base44.functions.invoke('fleetUnitMetrics', {
        range: { type: range.type, start: range.start, end: range.end },
        vehicle_ids: vehicleIds,
        trailingPeriods,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    enabled: !!tenantId && !!range?.start && !!range?.end,
    placeholderData: keepPreviousData,
  });
}

/**
 * Preferencia de visibilidad de unidades del /reports, por usuario (no por
 * tenant): cada admin/dispatcher elige qué unidades quiere seguir de una
 * flota de hasta ~100. Guarda el conjunto OCULTO (no uno visible) para que
 * una unidad nueva aparezca visible por default sin migrar nada.
 */
export function useUnitVisibility() {
  const { tenantId } = useTenant();
  const { data: rows = [], isLoading } = useEntityList('DashboardUnitPref');
  const invalidate = useInvalidateEntity();
  const pref = rows[0] || null;
  const hiddenIds = pref?.hidden_vehicle_ids || [];

  const setHiddenIds = useCallback(async (nextHiddenIds) => {
    if (!tenantId) return;
    if (pref) {
      await base44.entities.DashboardUnitPref.update(pref.id, { hidden_vehicle_ids: nextHiddenIds });
    } else {
      await base44.entities.DashboardUnitPref.create({ tenant_id: tenantId, hidden_vehicle_ids: nextHiddenIds });
    }
    invalidate('DashboardUnitPref');
  }, [tenantId, pref, invalidate]);

  const toggleVehicle = useCallback((vehicleId) => {
    const next = hiddenIds.includes(vehicleId) ? hiddenIds.filter((id) => id !== vehicleId) : [...hiddenIds, vehicleId];
    return setHiddenIds(next);
  }, [hiddenIds, setHiddenIds]);

  return { hiddenIds, isLoading, setHiddenIds, toggleVehicle };
}

/** Comentarios ad-hoc (UnitDayNote) de una unidad, para el detalle de celda de la matriz. */
export function useUnitDayNotes(vehicleId) {
  return useEntityList('UnitDayNote', { filter: { vehicle_id: vehicleId }, enabled: !!vehicleId });
}
