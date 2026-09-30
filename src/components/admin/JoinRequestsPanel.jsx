import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { invokeOkFunction } from '@/lib/invokeFunction';
import { ASSIGNABLE_ROLES, DEFAULT_APPROVAL_ROLE } from '@/lib/joinRequests';
import { ROLE_CONFIG } from '@/components/admin/roleConfig';

// Solicitudes de unión por código. Quien redime el código de la organización NO
// entra: queda aquí hasta que un owner/admin elige su rol y la aprueba, o la
// rechaza. Todo pasa por manageMember (service role); el navegador no lee la
// entidad JoinRequest.
function RequestRow({ request, onResolved }) {
  const [role, setRole] = useState(DEFAULT_APPROVAL_ROLE);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const resolve = async (action) => {
    setBusy(action);
    setError('');
    try {
      await invokeOkFunction('manageMember', action === 'approveRequest'
        ? { action, requestId: request.id, role }
        : { action, requestId: request.id });
      await onResolved();
    } catch (e) {
      setError(e?.message || 'No se pudo completar la acción. Inténtalo de nuevo.');
      setBusy('');
    }
  };

  return (
    <li className="px-5 py-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{request.name || request.email}</p>
          {request.name && <p className="text-xs text-muted-foreground truncate">{request.email}</p>}
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-9 w-40 text-sm" aria-label="Rol al aprobar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNABLE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_CONFIG[r]?.label || r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5" disabled={!!busy} onClick={() => resolve('approveRequest')}>
          {busy === 'approveRequest' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Aprobar
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" disabled={!!busy} onClick={() => resolve('rejectRequest')}>
          {busy === 'rejectRequest' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          Rechazar
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

export default function JoinRequestsPanel({ tenantId, onApproved }) {
  const q = useQuery({
    queryKey: ['join-requests', tenantId ?? null],
    queryFn: async () => (await invokeOkFunction('manageMember', { action: 'listRequests' })).requests || [],
    enabled: !!tenantId,
    refetchInterval: 60 * 1000,
  });
  const requests = q.data ?? [];
  if (q.isLoading || requests.length === 0) return null;

  const resolved = async () => {
    await q.refetch();
    onApproved?.();
  };

  return (
    <section className="bg-card border border-primary/40 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <UserCheck className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Solicitudes de unión ({requests.length})
        </h2>
      </div>
      <p className="px-5 pt-3 text-xs text-muted-foreground">
        Estas personas usaron el código de tu organización. No ven nada hasta que las apruebes y elijas su rol.
      </p>
      <ul className="divide-y divide-border">
        {requests.map((r) => <RequestRow key={r.id} request={r} onResolved={resolved} />)}
      </ul>
    </section>
  );
}
