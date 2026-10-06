import { useState, useEffect, useMemo } from 'react';
import { invokeFunction } from '@/lib/invokeFunction';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { LifeBuoy, RefreshCw } from 'lucide-react';
import { TICKET_STATUSES, TICKET_CATEGORIES, TICKET_PRIORITIES, labelFor, statusColor } from '@/lib/support';

const badgeClasses = {
  warning: 'bg-warning/10 text-warning',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  muted: 'bg-muted text-muted-foreground',
};

function StatusBadge({ status }) {
  const color = statusColor(status);
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClasses[color] || badgeClasses.muted}`}>
      {labelFor(TICKET_STATUSES, status)}
    </span>
  );
}

/**
 * Tickets — panel de soporte del owner de la app (ruta protegida por RequireAppOwner).
 * Lista todos los tickets cross-tenant vía la función `ticketsAdmin` (service role),
 * permite cambiar el estatus y responder (notificando al solicitante por correo).
 */
export default function Tickets() {
  const { isAppOwner } = useTenant();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    invokeFunction('ticketsAdmin', { action: 'list' })
      .then((body) => setTickets(body?.tickets || []))
      .catch((e) => setError(e?.message || 'No se pudieron cargar los tickets.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isAppOwner) load(); else setLoading(false); }, [isAppOwner]);

  // Mantén el ticket abierto sincronizado con la lista recargada.
  const selectedTicket = useMemo(
    () => (selected ? tickets.find((t) => t.id === selected.id) || selected : null),
    [tickets, selected],
  );

  const counts = useMemo(() => {
    const c = { all: tickets.length };
    for (const s of TICKET_STATUSES) c[s.value] = tickets.filter((t) => t.status === s.value).length;
    return c;
  }, [tickets]);

  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  const setStatus = async (ticket, status) => {
    setBusy(true);
    setError('');
    try {
      await invokeFunction('ticketsAdmin', { action: 'set_status', ticketId: ticket.id, status });
      load();
    } catch (e) { setError(e?.message || 'No se pudo actualizar el estatus.'); } finally { setBusy(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selectedTicket) return;
    setBusy(true);
    setError('');
    try {
      await invokeFunction('ticketsAdmin', { action: 'reply', ticketId: selectedTicket.id, body: reply.trim() });
      setReply('');
      load();
    } catch (e) { setError(e?.message || 'No se pudo enviar la respuesta.'); } finally { setBusy(false); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Soporte"
        subtitle={`${counts.open || 0} abiertos · ${tickets.length} en total`}
        action={(
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        )}
      />

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {/* Filtros por estatus */}
      <div className="flex flex-wrap gap-1 bg-muted rounded-lg p-1 mb-4">
        {[{ value: 'all', label: 'Todos' }, ...TICKET_STATUSES].map(({ value, label }) => (
          <button key={value} onClick={() => setFilter(value)}
            className={`flex-1 whitespace-nowrap py-1.5 px-2 text-xs font-medium rounded-md transition-all ${filter === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {label} ({counts[value] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="Sin tickets" description="No hay tickets en esta vista." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)}
              className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all">
              <div className="flex items-center gap-2 flex-wrap">
                {t.ticket_number && (
                  <span className="text-xs font-mono font-semibold text-primary shrink-0">{t.ticket_number}</span>
                )}
                <p className="text-sm font-semibold flex-1 min-w-0 truncate">{t.subject}</p>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {t.tenant_name || t.tenant_id} · {t.requester_name || t.requester_email} · {labelFor(TICKET_CATEGORIES, t.category)} · {labelFor(TICKET_PRIORITIES, t.priority)}
              </p>
            </button>
          ))}
        </div>
      )}

      {selectedTicket && (
        <ResponsiveModal title={selectedTicket.subject} onClose={() => setSelected(null)} maxWidth="lg">
          <div className="space-y-3">
            {selectedTicket.ticket_number && (
              <p className="text-sm font-mono font-semibold text-primary">{selectedTicket.ticket_number}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <StatusBadge status={selectedTicket.status} />
              <span>{selectedTicket.tenant_name || selectedTicket.tenant_id}</span>
              <span>· {labelFor(TICKET_CATEGORIES, selectedTicket.category)}</span>
              <span>· {labelFor(TICKET_PRIORITIES, selectedTicket.priority)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              De: {selectedTicket.requester_name || '—'} {selectedTicket.requester_email ? `<${selectedTicket.requester_email}>` : ''}
            </p>
            <div className="bg-secondary/50 border border-border rounded-lg p-3 text-sm whitespace-pre-wrap">{selectedTicket.body}</div>

            {/* Hilo de respuestas */}
            {Array.isArray(selectedTicket.responses) && selectedTicket.responses.length > 0 && (
              <div className="space-y-2">
                {selectedTicket.responses.map((r, i) => (
                  <div key={i} className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                    <p className="text-xs font-medium text-primary mb-0.5">{r.author_name || 'Soporte'}</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{r.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Responder */}
            <div>
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} className="bg-background min-h-24" placeholder="Escribe una respuesta para el solicitante…" />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Button size="sm" onClick={sendReply} disabled={busy || !reply.trim()}>Enviar respuesta</Button>
                <div className="flex-1" />
                {TICKET_STATUSES.map((s) => (
                  <Button key={s.value} size="sm" variant={selectedTicket.status === s.value ? 'default' : 'outline'}
                    disabled={busy || selectedTicket.status === s.value}
                    onClick={() => setStatus(selectedTicket, s.value)}>
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ResponsiveModal>
      )}
    </div>
  );
}
