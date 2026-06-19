import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';

/**
 * Tenant-scoped data layer over the Base44 SDK.
 *
 * Pages used to fetch with `useState + useEffect + Promise.all` and a manual
 * `loading` flag, re-fetching everything on every navigation with no caching
 * and inconsistent error handling. These hooks centralize entity access on top
 * of React Query (already mounted in App.jsx) so reads are cached, deduplicated
 * across components, and refetched declaratively after mutations.
 */

// Stable query key for a tenant-scoped entity read.
export function entityKey(entity, tenantId, params) {
  return ['entity', entity, tenantId ?? null, params ?? null];
}

/**
 * Tenant-scoped list query for a Base44 entity.
 *
 * @param {string} entity            Entity name, e.g. 'Vehicle'.
 * @param {object} [opts]
 * @param {object} [opts.filter]     Extra filter merged with the tenant scope.
 * @param {string} [opts.sort]       Sort string, e.g. '-created_date'.
 * @param {number} [opts.limit]      Max rows.
 * @param {boolean} [opts.enabled]   Gate the query (default true).
 */
export function useEntityList(entity, { filter, sort, limit, enabled = true } = {}) {
  const { tenantId } = useTenant();
  const scopedFilter = { ...(tenantId ? { tenant_id: tenantId } : {}), ...filter };
  return useQuery({
    queryKey: entityKey(entity, tenantId, { filter: filter ?? null, sort: sort ?? null, limit: limit ?? null }),
    queryFn: () => base44.entities[entity].filter(scopedFilter, sort, limit),
    enabled,
  });
}

/**
 * Returns an `invalidate(entity)` callback to refetch every cached read for an
 * entity after a create/update/delete. Replaces the old manual `load()` refetch.
 */
export function useInvalidateEntity() {
  const qc = useQueryClient();
  return useCallback(
    (...entities) => entities.forEach((entity) => qc.invalidateQueries({ queryKey: ['entity', entity] })),
    [qc],
  );
}

// Convenience hooks for the entities used across multiple pages.
export const useVehicles = (opts) => useEntityList('Vehicle', opts);
export const useDrivers = (opts) => useEntityList('Driver', { sort: '-created_date', ...opts });
export const useAlerts = (opts) => useEntityList('Alert', opts);
export const useMessages = (opts) => useEntityList('Message', opts);
export const useRentCharges = (opts) => useEntityList('RentCharge', opts);
