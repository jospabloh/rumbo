// Pure threshold logic for module 20 Layer 3 (stale sessions reaped). Mirrored
// (necessarily duplicated, not imported — Deno functions in base44/functions/ can't
// import from src/, same reasoning as guardedEntityWrite's inline moduleCan() copy)
// in base44/functions/reapStaleSessions/entry.ts. Kept here too so the exact cutoff
// math has a unit test independent of the Base44 sandbox.

// 48h — the portfolio default (shared/session/README.md): long enough that a
// legitimate multi-day-away laptop sleep doesn't get logged out from under someone,
// short enough that a truly dead session doesn't sit "active" for weeks.
export const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

/**
 * @param {string|null|undefined} lastActiveAt ISO timestamp of the session's last heartbeat.
 * @param {number} nowMs `Date.now()` at evaluation time (passed in, not read here, so this stays pure).
 * @param {number} thresholdMs defaults to STALE_AFTER_MS.
 * @returns {boolean} true if the session is stale and should be reaped.
 */
export function isSessionStale(lastActiveAt, nowMs, thresholdMs = STALE_AFTER_MS) {
  if (!lastActiveAt) return false;
  const last = new Date(lastActiveAt).getTime();
  if (Number.isNaN(last)) return false;
  return nowMs - last > thresholdMs;
}
