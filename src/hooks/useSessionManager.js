import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';

/**
 * ACACIA portfolio session control — Module 20 of STANDARD.md, Layer 1.
 *
 * Canonical source: jospabloh/acacia-app-standard → shared/session/useSessionManager.js.
 * That version also owns the device/heartbeat/"manageSession" round-trip (Layer 2) —
 * this app already has that, independently, in src/lib/SessionHeartbeat.jsx (built
 * earlier for Mission Control's force-logout, against the AppSession entity directly
 * rather than a `session` function). Re-implementing session/heartbeat management
 * here would be a second, competing writer of the same AppSession row, so this hook
 * is trimmed to ONLY Layer 1: idle detection, the warning countdown, and the local
 * "session expired" state the two dialogs render. SessionHeartbeat.jsx still owns
 * creating/renewing the row and reacting to a server-side revoke (Layer 3's reap job,
 * or Mission Control's manual revoke) — that path already forces a logout on its own
 * and needs no change here.
 *
 * Keep the thresholds identical across the portfolio unless an app has a documented
 * reason to differ (in its own CLAUDE.md, not silently here) — an operator running
 * two ACACIA apps should meet the same idle warning at the same point in both.
 */

const IDLE_WARNING_MS = 20 * 60 * 1000;   // 20 min → show warning
const IDLE_LOGOUT_MS  =  2 * 60 * 1000;   // 2 min after warning → session considered expired
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];

export function useSessionManager() {
  const { isAuthenticated } = useAuth();
  const [idleState, setIdleState] = useState(null);       // null | 'idle_warning'
  const [sessionExpired, setSessionExpired] = useState(false);

  const idleTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);

  const resetIdleTimers = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    setIdleState(null);

    idleTimerRef.current = setTimeout(() => {
      setIdleState('idle_warning');
      logoutTimerRef.current = setTimeout(() => {
        setSessionExpired(true);
        setIdleState(null);
      }, IDLE_LOGOUT_MS);
    }, IDLE_WARNING_MS);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimeout(idleTimerRef.current);
      clearTimeout(logoutTimerRef.current);
      setIdleState(null);
      setSessionExpired(false);
      return;
    }

    const onActivity = () => resetIdleTimers();
    ACTIVITY_EVENTS.forEach((e) => globalThis.addEventListener(e, onActivity, { passive: true }));
    resetIdleTimers(); // start timers immediately

    return () => {
      ACTIVITY_EVENTS.forEach((e) => globalThis.removeEventListener(e, onActivity));
      clearTimeout(idleTimerRef.current);
      clearTimeout(logoutTimerRef.current);
    };
  }, [isAuthenticated, resetIdleTimers]);

  // Clicking "Continuar trabajando" in the warning dialog before the countdown runs out.
  const continueSession = useCallback(() => {
    clearTimeout(logoutTimerRef.current);
    resetIdleTimers();
  }, [resetIdleTimers]);

  return { idleState, sessionExpired, continueSession };
}
