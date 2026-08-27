import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getCurrentSessionId } from '@/lib/session/sessionId';

/**
 * useActivityTracker — Module 20 (session control), Layer 1's activity signal.
 * Adapted from jospabloh/acacia-app-standard → shared/session/useActivityTracker.js.
 *
 * Canonical wires this to a `session` Base44 function's `trackActivity` action,
 * feeding Mission Control's separate usage/engagement table — this app has
 * neither, so the adaptation targets what this app DOES have: the current tab's
 * own AppSession.last_active_at (src/lib/SessionHeartbeat.jsx's row, found via
 * the id it caches in sessionStorage — see src/lib/session/sessionId.js).
 *
 * This is deliberately a SEPARATE, lower-frequency write from SessionHeartbeat's
 * own interval-based one: that heartbeat bumps last_active_at every ~60s purely
 * because the tab is open and visible, whether or not a person actually did
 * anything in it. This hook only fires on real DOM activity (throttled to at
 * most once/hour, global across renders so remounts can't bypass it), so it is
 * the more honest "a person did something" signal — harmless to also write the
 * same field SessionHeartbeat writes (both just set it to "now").
 */

const THROTTLE_MS = 60 * 60 * 1000; // 60 minutes — global across all renders
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'click', 'scroll', 'touchstart'];
let lastSentGlobal = 0;

async function sendActivity() {
  const now = Date.now();
  if (now - lastSentGlobal < THROTTLE_MS) return;
  const sessionId = getCurrentSessionId();
  if (!sessionId) return;
  lastSentGlobal = now;
  try {
    await base44.entities.AppSession.update(sessionId, { last_active_at: new Date().toISOString() });
  } catch {
    // Silently ignore — activity tracking is best-effort, same as SessionHeartbeat.
  }
}

// isAuthenticated: pass useAuth()'s flag — the hook no-ops until the user is
// actually signed in (mirrors the canonical's "don't fire before we know who
// this is" gate, adapted from a tenantId gate since this signal isn't tenant-scoped).
export function useActivityTracker(isAuthenticated) {
  useEffect(() => {
    if (!isAuthenticated) return;

    const onActivity = () => sendActivity();
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, onActivity, { passive: true }));

    const onVisible = () => {
      if (document.visibilityState === 'visible') sendActivity();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated]);
}
