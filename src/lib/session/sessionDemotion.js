// Pure logic for module 20 Layer 2 ("one active device, surfaced"): a fresh login
// on a new device should mark itself 'active' and demote every OTHER session this
// same user already has (across their other devices/tabs) to 'passive'. Kept as a
// standalone pure function — no imports, no SDK — so it's directly unit-testable
// and so SessionHeartbeat.jsx's own effect stays a thin caller of this decision.
//
// `sessions` is whatever the caller already fetched for this user (RLS on
// AppSession already scopes reads to the caller's own created_by_id rows, so this
// never needs to reason about other users' sessions at all).

/**
 * @param {Array<{id: string, status?: string, revoked_at?: string|null}>} sessions
 *   The user's own existing AppSession rows (may include the one just created).
 * @param {string} newSessionId The id of the session that should end up 'active'.
 * @returns {string[]} ids that need `{ status: 'passive' }` written — every OTHER
 *   session that isn't already revoked and isn't already 'passive'.
 */
export function pickSessionsToDemote(sessions, newSessionId) {
  if (!Array.isArray(sessions) || !newSessionId) return [];
  return sessions
    .filter((s) => s && s.id && s.id !== newSessionId)
    .filter((s) => !s.revoked_at) // a revoked row's status is moot — leave it alone
    .filter((s) => (s.status ?? 'active') !== 'passive') // already passive: nothing to do
    .map((s) => s.id);
}
