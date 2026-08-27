import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * reapStaleSessions — Module 20 (session control) of STANDARD.md, Layer 3.
 *
 * This is the failure mode Layer 1 (the client-side idle timer,
 * src/hooks/useSessionManager.js) structurally cannot close: a session whose
 * device died — battery drained, tab killed by the OS, laptop closed and
 * never reopened — never sends another heartbeat, so its AppSession row sits
 * with no fresh `last_active_at` forever, nothing client-side left to log it
 * out. A scheduled server-side job has to close it instead.
 *
 * Shaped after jospabloh/acacia-app-standard →
 * shared/session/purgeStaleSessions.example.ts, adapted to this app's actual
 * entity (AppSession, not the example's "Session") and its actual revocation
 * field (`revoked_at`/`revoked_by`, not a `status: 'revoked'` enum value — this
 * app's `status` field means something else here: module 20 Layer 2's
 * active/passive device signal, added alongside this same PR).
 *
 * Revoking here is the whole fix: SessionHeartbeat.jsx's own existing
 * `enforce()` check already treats a revoked row as a forced logout on the
 * device's next heartbeat — the same guard rail Mission Control's manual
 * force-logout path already relies on. No separate client change was needed
 * for that half.
 *
 * KNOWN GAP (documented, not silently assumed): this repo has no existing
 * scheduled-function mechanism — no cron entry in base44.app.json, no
 * scheduler config anywhere in this repo, and no other `base44/functions/`
 * entry point that runs on a timer (grepped for CRON/cron/schedule* across
 * base44/ and docs/ before writing this — nothing). This function exists and
 * works when invoked, but nothing in this repo currently calls it on a
 * schedule. Wiring an actual scheduler (a Base44-native cron if the platform
 * exposes one for this app, or an external one hitting this URL with the
 * secret below) is OUT OF SCOPE here and needs whoever has access to set it
 * up — see the module 20 CLAUDE.md entry.
 *
 * Fails CLOSED the same way Mission Control's requireCron.js and this
 * app's own APP_OWNER_EMAIL-gated functions already do (module 14): an unset
 * CRON_SECRET means 503, never "ran anyway open to the world" — this endpoint
 * would otherwise let anyone who finds the URL force-logout every user in
 * the app.
 */

const STALE_AFTER_MS = 48 * 60 * 60 * 1000; // 48h — the portfolio default, see module 20

// Mirrors src/lib/session/staleThreshold.js's isSessionStale() — duplicated,
// not imported, because Deno functions here can't import from src/ (same
// reasoning as guardedEntityWrite's inline moduleCan() copy). Keep both in
// sync if the threshold or its math ever changes.
function isSessionStale(lastActiveAt: string | null | undefined, nowMs: number, thresholdMs = STALE_AFTER_MS): boolean {
  if (!lastActiveAt) return false;
  const last = new Date(lastActiveAt).getTime();
  if (Number.isNaN(last)) return false;
  return nowMs - last > thresholdMs;
}

function requireCron(req: Request): Response | null {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) {
    // Fail CLOSED — an unset secret must never mean "run anyway."
    return Response.json({ error: 'CRON_SECRET no configurado' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const guardResponse = requireCron(req);
  if (guardResponse) return guardResponse;

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const now = Date.now();

    // Fetched in-memory rather than via a $lt filter on an ISO date-time
    // string field — this repo's other date-cutoff filters (acaciaControl's
    // AcaciaReplayKey, joinTenant's JoinAttempt) only ever compare numeric
    // epoch fields, so an ISO-string $lt here would be unverified behavior
    // against a field nothing else in this repo has filtered that way.
    // AppSession has no tenant_id (module 14: it's cross-tenant by design,
    // for Mission Control's own bridge), so this is a full-table scan by
    // construction, not a missed tenant scope.
    const all = await svc.entities.AppSession.list();

    // Do NOT filter to status: 'active' only — module 20 is explicit that a
    // 'passive' (not-currently-primary) device goes stale exactly the same
    // way an 'active' one does, and both need reaping.
    const toRevoke = (all ?? []).filter(
      (s: any) => !s.revoked_at && isSessionStale(s.last_active_at, now)
    );

    let revoked = 0;
    for (const session of toRevoke) {
      try {
        await svc.entities.AppSession.update(session.id, {
          revoked_at: new Date(now).toISOString(),
          revoked_by: 'system',
        });
        revoked++;
      } catch {
        // Best-effort per-row — one failed update shouldn't abort the whole reap pass.
      }
    }

    return Response.json({ ok: true, revoked, checked: (all ?? []).length, cutoff_ms: STALE_AFTER_MS });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
