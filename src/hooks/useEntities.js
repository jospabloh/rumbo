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

/**
 * Un-scoped list read for an entity (`entity.list(sort, limit)`), for the few
 * places that intentionally don't filter by `tenant_id` (e.g. `TenantLicense`,
 * whose id *is* the tenant, or `User`). Tenant isolation still comes from RLS.
 *
 * @param {string} entity
 * @param {{ sort?: string, limit?: number, enabled?: boolean }} [opts]
 */
export function useRawList(entity, { sort, limit, enabled = true } = {}) {
  return useQuery({
    queryKey: ['entity', entity, 'list', sort ?? null, limit ?? null],
    queryFn: () => base44.entities[entity].list(sort, limit),
    enabled,
  });
}

/** The signed-in user profile (`auth.me`), cached and shared across the app. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The Driver record linked to the signed-in user — resolves the
 * user → driver lookup that every /driver/* page repeats.
 */
export function useCurrentDriver() {
  const { data: user } = useMe();
  return useQuery({
    queryKey: ['currentDriver', user?.id ?? null],
    queryFn: async () => {
      const drivers = await base44.entities.Driver.list();
      return drivers.find((d) => d.profile_id === user.id) ?? null;
    },
    enabled: !!user?.id,
  });
}
