import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { getCurrentSessionId } from '@/lib/session/sessionId';
import { useMe } from '@/hooks/useEntities';
import { Monitor, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * "Sesiones activas" — Module 20 (session control), Layer 2, surfaced.
 *
 * Standalone component (not inlined into DangerZone.jsx) so this addition stays
 * a one-import/one-render diff there — another fix may be touching that file
 * concurrently, and this keeps a later rebase easy.
 *
 * List: AppSession's own `read` RLS already scopes results to the caller's own
 * created_by_id rows (see AppSession.jsonc) — no new backend function needed,
 * a plain base44.entities.AppSession.filter() already returns only "mine".
 * Revoke: same reasoning for `update` — the caller can already write their own
 * row directly, so "Revocar" is a direct entity update, not a new function.
 * Both confirmed against the entity's actual deployed RLS (not assumed) before
 * writing this — see the module 20 CLAUDE.md entry.
 */
export default function ActiveSessions() {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  const userEmail = user?.email;
  const [revokingId, setRevokingId] = useState(null);
  const [error, setError] = useState(null);
  const currentId = getCurrentSessionId();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['app-sessions', userEmail ?? null],
    queryFn: () => base44.entities.AppSession.filter({ user_email: userEmail }),
    enabled: !!userEmail,
  });

  // Never a device this user revoked already, and never one Mission Control
  // force-closed — those aren't "active" anymore, just old rows.
  const visible = sessions
    .filter((s) => !s.revoked_at)
    .sort((a, b) => new Date(b.last_active_at || b.started_at || 0).getTime() - new Date(a.last_active_at || a.started_at || 0).getTime());

  const handleRevoke = async (id) => {
    setRevokingId(id);
    setError(null);
    try {
      await base44.entities.AppSession.update(id, {
        revoked_at: new Date().toISOString(),
        revoked_by: userEmail,
      });
      queryClient.invalidateQueries({ queryKey: ['app-sessions', userEmail ?? null] });
    } catch (e) {
      setError('No se pudo revocar esa sesión. Intenta de nuevo.');
      console.error('Revoke AppSession failed:', e);
    } finally {
      setRevokingId(null);
    }
  };

  if (isLoading || visible.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-destructive/20 pt-4">
      <div className="flex items-start gap-3">
        <Monitor className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Sesiones activas</p>
          <p className="text-xs text-muted-foreground">
            Dispositivos donde tu cuenta ha iniciado sesión. Si no reconoces alguno, revócalo.
          </p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {visible.map((s) => {
          const isCurrent = s.id === currentId;
          const lastActive = s.last_active_at || s.started_at;
          return (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {s.device || 'Navegador'}
                  {isCurrent && <span className="ml-2 text-xs text-primary font-medium">(este dispositivo)</span>}
                  {!isCurrent && s.status === 'active' && (
                    <span className="ml-2 text-xs text-muted-foreground">también activo</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lastActive
                    ? `hace ${formatDistanceToNow(new Date(lastActive), { locale: es })}`
                    : 'sin actividad registrada'}
                </p>
              </div>
              {!isCurrent && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 shrink-0"
                  disabled={revokingId === s.id}
                  onClick={() => handleRevoke(s.id)}
                >
                  <ShieldOff className="w-3.5 h-3.5" />
                  {revokingId === s.id ? 'Revocando...' : 'Revocar'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
