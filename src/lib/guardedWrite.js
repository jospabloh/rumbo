import { invokeOkFunction } from '@/lib/invokeFunction';

/**
 * Thin client wrapper around the guardedEntityWrite Safe function — the
 * sanctioned write path for the 14 module-scoped operational entities (see
 * base44/functions/guardedEntityWrite/entry.ts for the full entity list and
 * what it enforces: role + docs/permissions_matrix.md's per-tenant
 * permissions_config + billing write_access, plus the driver role's
 * self-record scoping).
 *
 * The real error-surfacing logic (base44.functions.invoke()'s
 * interceptResponses:false gotcha) lives in src/lib/invokeFunction.js now —
 * it turned out to affect every function call site in the app, not just this
 * one, so it was pulled out into a shared helper instead of staying
 * guardedEntityWrite-specific. See that file's own comment for the detail.
 */

export async function guardedCreate(entity, data) {
  const body = await invokeOkFunction('guardedEntityWrite', { entity, operation: 'create', data });
  return body.record;
}

export async function guardedUpdate(entity, id, data) {
  const body = await invokeOkFunction('guardedEntityWrite', { entity, operation: 'update', id, data });
  return body.record;
}

export async function guardedDelete(entity, id) {
  await invokeOkFunction('guardedEntityWrite', { entity, operation: 'delete', id });
}
