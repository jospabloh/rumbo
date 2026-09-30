// Solicitudes de unión por código (2026-09-30).
//
// Unirse con el código de la organización deja una solicitud pendiente; un
// owner/admin la aprueba en Administración eligiendo el rol. Esta es la lista de
// roles que se pueden elegir al aprobar. Espeja ASSIGNABLE_ROLES de
// base44/functions/manageMember/entry.ts (Deno no puede importar de src/) y un
// test compara las dos. 'owner' nunca está: la propiedad se mueve solo con
// delegateOwnership.
export const ASSIGNABLE_ROLES = ['admin', 'dispatcher', 'mechanic', 'driver', 'investor', 'user'];

// Rol por defecto que se propone al aprobar: el de menor privilegio útil.
export const DEFAULT_APPROVAL_ROLE = 'driver';

// Estados que resolveTenant puede devolver en `join_request`.
export const JOIN_REQUEST_PENDING = 'pending';
export const JOIN_REQUEST_REJECTED = 'rejected';

/** Normaliza lo que devuelve resolveTenant (`join_request`) o null. */
export function normalizeJoinRequest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.status !== JOIN_REQUEST_PENDING && raw.status !== JOIN_REQUEST_REJECTED) return null;
  return {
    id: raw.id || null,
    status: raw.status,
    tenantName: raw.tenant_name || 'la organización',
    requestedAt: raw.requested_at || null,
  };
}
