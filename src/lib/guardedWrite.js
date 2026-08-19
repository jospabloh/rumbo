import { base44 } from '@/api/base44Client';

/**
 * Thin client wrapper around the guardedEntityWrite Safe function — the
 * sanctioned write path for the 14 module-scoped operational entities (see
 * base44/functions/guardedEntityWrite/entry.ts for the full entity list and
 * what it enforces: role + docs/permissions_matrix.md's per-tenant
 * permissions_config + billing write_access, plus the driver role's
 * self-record scoping).
 *
 * Note the calling convention: base44.functions.invoke() in this app returns
 * `{ data: <body> }`, not the body directly (different from some other apps
 * in this portfolio) — these helpers unwrap that and throw on a non-ok body
 * so call sites can just `await` and catch, same as any other entity call.
 */
async function invokeGuarded(payload) {
  const resp = await base44.functions.invoke('guardedEntityWrite', payload);
  const body = resp?.data;
  if (!body?.ok) {
    const err = /** @type {Error & { code?: string }} */ (new Error(body?.error || 'guardedEntityWrite failed'));
    err.code = body?.code;
    throw err;
  }
  return body;
}

export async function guardedCreate(entity, data) {
  const body = await invokeGuarded({ entity, operation: 'create', data });
  return body.record;
}

export async function guardedUpdate(entity, id, data) {
  const body = await invokeGuarded({ entity, operation: 'update', id, data });
  return body.record;
}

export async function guardedDelete(entity, id) {
  await invokeGuarded({ entity, operation: 'delete', id });
}
