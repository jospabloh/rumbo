import { base44 } from '@/api/base44Client';

/**
 * Shared wrapper around base44.functions.invoke() — every backend function
 * call in this app should go through this instead of calling invoke()
 * directly, because of a calling-convention gotcha that was first found and
 * fixed (2026-08-26) for guardedEntityWrite specifically and then confirmed
 * to affect every other function call site in the app equally, so it was
 * pulled out here instead of copy-pasted:
 *
 * base44.functions.invoke() in this app returns `{ data: <body> }` on
 * success, not the body directly — the client is built with
 * `interceptResponses: false` for the functions axios instance (see
 * @base44/sdk's client.js), so `invoke()` is plain axios with none of the
 * SDK's usual response-unwrapping or error-normalizing interceptors.
 *
 * That cuts both ways: on a non-2xx response (every Deno function in this
 * repo signals its own errors with `Response.json({error, ...}, {status})`,
 * not a 200 body), axios REJECTS the promise with a raw `AxiosError` whose
 * `.message` is just "Request failed with status code N" — the actual
 * `{error, code?}` body the function wrote lives at `err.response.data`, one
 * level down, and is lost entirely unless something goes looking for it
 * there. Found via real user feedback on `guardedEntityWrite` first (an
 * owner's vehicle edit failed and all he saw was the generic status-code
 * message); a repo-wide grep afterward found ~15 other call sites with the
 * identical raw `invoke()` pattern, each one dropping its function's real
 * error message the same way whenever that function returns non-2xx.
 *
 * @param {string} name - the Base44 function name (e.g. 'manageMember')
 * @param {object} payload - the request body
 * @returns {Promise<any>} the parsed response body on success
 * @throws {Error & {code?: string}} with the function's real error message
 */
export async function invokeFunction(name, payload) {
  let resp;
  try {
    resp = await base44.functions.invoke(name, payload);
  } catch (err) {
    const body = err?.response?.data;
    const wrapped = /** @type {Error & { code?: string }} */ (
      new Error(body?.error || err?.message || `${name} failed`)
    );
    wrapped.code = body?.code;
    throw wrapped;
  }
  return resp?.data;
}

/**
 * Same as invokeFunction(), but for functions that signal their own failure
 * via a 2xx response carrying `{ ok: false, error, code }` (guardedEntityWrite's
 * convention) rather than relying on the HTTP status alone. Throws in both
 * failure shapes so callers only need one catch block.
 */
export async function invokeOkFunction(name, payload) {
  const body = await invokeFunction(name, payload);
  if (!body?.ok) {
    const err = /** @type {Error & { code?: string }} */ (new Error(body?.error || `${name} failed`));
    err.code = body?.code;
    throw err;
  }
  return body;
}
