// Shared sessionStorage key for "which AppSession row is THIS tab" — module 20
// (session control). SessionHeartbeat.jsx creates/reuses this id; ActiveSessions.jsx
// (the "Sesiones activas" panel in the Danger Zone) needs the SAME id to know which
// row in the list is the current one (so it never offers a "Revocar" button for the
// session the user is looking at from). One exported constant so the two files can
// never drift onto different key names.
export const SS_KEY = 'acacia_session_id';

/** The current tab's AppSession id, or null if none has been created yet. */
export function getCurrentSessionId() {
  try {
    return sessionStorage.getItem(SS_KEY);
  } catch {
    // sessionStorage can throw in some private-browsing / locked-down contexts.
    return null;
  }
}
