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
 * `{ data: <body> }` on success, not the body directly (different from some
 * other apps in this portfolio) — this is because the client is built with
 * `interceptResponses: false` for the functions axios instance (see
 * @base44/sdk's client.js), so `invoke()` is plain axios with none of the
 * SDK's usual response-unwrapping or error-normalizing interceptors.
 *
 * That cuts both ways: on a non-2xx response (every `bad()` reply in
 * entry.ts — 400/403/404/409/500), axios rejects the promise with a raw
 * `AxiosError` whose `.message` is just "Request failed with status code
 * N" — the actual `{ ok:false, code, error }` body guardedEntityWrite wrote
 * lives at `err.response.data`, one level down, and is lost entirely unless
 * something goes looking for it there. Found via real user feedback: an
 * owner's vehicle edit failed and all he saw was "Request failed with
 * status code 400" — the actual reason was never shown, whatever it was.
 */
async function invokeGuarded(payload) {
  let resp;
  try {
    resp = await base44.functions.invoke('guardedEntityWrite', payload);
  } catch (err) {
    const body = err?.response?.data;
    const wrapped = /** @type {Error & { code?: string }} */ (
      new Error(body?.error || err?.message || 'guardedEntityWrite failed')
    );
    wrapped.code = body?.code;
    throw wrapped;
  }
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
