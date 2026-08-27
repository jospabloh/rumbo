import { useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { base44 } from '@/api/base44Client';
import { SS_KEY } from '@/lib/session/sessionId';
import { pickSessionsToDemote } from '@/lib/session/sessionDemotion';

// SessionHeartbeat — records this browser's login as an AppSession row and keeps
// its last_active_at fresh so ACACIA Mission Control can show "sesiones activas"
// and force a logout. On each heartbeat (and on load) it checks its own row: if
// Mission Control set revoked_at, the user is logged out immediately. Mounted
// once, app-wide, next to NavigationTracker. Best-effort throughout — session
// tracking must never break the app.
//
// Module 20 (session control), Layer 2: a FRESH login (a new row, not one reused
// from sessionStorage) is created `status: 'active'` and every OTHER session this
// user already has gets demoted to `status: 'passive'` — surfaced by
// src/components/admin/ActiveSessions.jsx ("Sesiones activas" in the Danger
// Zone), not hidden. This is a UX signal only (module 20's own "what this is
// not"): a `passive` device keeps working exactly as before.

const HEARTBEAT_MS = 60_000;   // move last_active_at at most this often

// A short, human device label from the user agent: "Chrome · macOS".
function deviceLabel() {
  const ua = navigator.userAgent || '';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Windows/.test(ua) ? 'Windows' :
    /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

export default function SessionHeartbeat() {
  const { isAuthenticated, user, logout } = useAuth();
  const idRef = useRef(null);
  const lastBeatRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;

    // Log the user out if their session row was revoked (or deleted) by MC.
    function enforce(rec, gone) {
      if (cancelled) return;
      if (gone || (rec && rec.revoked_at)) {
        sessionStorage.removeItem(SS_KEY);
        idRef.current = null;
        logout();
      }
    }

    // Ensure a session row exists for this tab; reuse the one in sessionStorage.
    async function ensureSession() {
      if (idRef.current) return idRef.current;
      const stored = sessionStorage.getItem(SS_KEY);
      if (stored) { idRef.current = stored; return stored; }
      const now = new Date().toISOString();
      try {
        const rec = await base44.entities.AppSession.create({
          user_email: user.email,
          user_name: user.full_name || user.email,
          device: deviceLabel(),
          started_at: now,
          last_active_at: now,
          status: 'active',
        });
        if (rec && rec.id) {
          sessionStorage.setItem(SS_KEY, rec.id);
          idRef.current = rec.id;
          lastBeatRef.current = Date.now();
          demoteOtherSessions(rec.id);
          return rec.id;
        }
      } catch { /* tracking is best-effort */ }
      return null;
    }

    // Module 20 Layer 2: a fresh login is this device's turn to be "active" —
    // every other session this same user already has (other tabs/devices) is
    // demoted to 'passive'. Read is already RLS-scoped to this user's own
    // created_by_id rows (see AppSession.jsonc), so filtering by user_email
    // can never reach another user's sessions. Best-effort: a failure here
    // just leaves an older row showing 'active' a while longer, which is
    // exactly the UX signal module 20 says is NOT an access-control boundary.
    async function demoteOtherSessions(newId) {
      try {
        const mine = await base44.entities.AppSession.filter({ user_email: user.email });
        const toDemote = pickSessionsToDemote(mine, newId);
        await Promise.allSettled(
          toDemote.map((id) => base44.entities.AppSession.update(id, { status: 'passive' }))
        );
      } catch { /* best-effort, same as the rest of this file */ }
    }

    // Update last_active_at and check for revocation in one round-trip.
    async function beat(force) {
      if (!force && Date.now() - lastBeatRef.current < HEARTBEAT_MS) return;
      const id = await ensureSession();
      if (!id || cancelled) return;
      lastBeatRef.current = Date.now();
      try {
        const rec = await base44.entities.AppSession.update(id, { last_active_at: new Date().toISOString() });
        enforce(rec, false);
      } catch (e) {
        // A 404 means MC (or a cleanup) removed the row → treat as revoked.
        if (e && (e.status === 404 || e.response?.status === 404)) enforce(null, true);
      }
    }

    // On load: create/reuse the row, then verify it isn't already revoked.
    (async () => {
      const id = await ensureSession();
      if (!id || cancelled) return;
      try { enforce(await base44.entities.AppSession.get(id), false); }
      catch (e) { if (e && (e.status === 404 || e.response?.status === 404)) enforce(null, true); }
    })();

    const timer = setInterval(() => { if (document.visibilityState === 'visible') beat(false); }, HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') beat(false); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, user, logout]);

  return null;
}
