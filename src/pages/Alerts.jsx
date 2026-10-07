import { useState, useMemo } from 'react';
import { invokeFunction } from '@/lib/invokeFunction';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useAlerts, useInvalidateEntity } from '@/hooks/useEntities';
import { guardedUpdate } from '@/lib/guardedWrite';
import { celebrate } from '@/lib/celebrate';

const severityConfig = {
  critical: { icon: AlertTriangle, cls: 'text-destructive bg-destructive/10 border-destructive/20', label: 'Crítica' },
  warning: { icon: AlertCircle, cls: 'text-warning bg-warning/10 border-warning/20', label: 'Aviso' },
  info: { icon: Info, cls: 'text-primary bg-primary/10 border-primary/20', label: 'Info' },
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

export default function Alerts() {
  const { data, isLoading: loading } = useAlerts({ filter: { resolved: false } });
  const invalidate = useInvalidateEntity();
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const alerts = useMemo(
    () => (data ?? []).slice().sort((x, y) => (SEVERITY_ORDER[x.severity] ?? 2) - (SEVERITY_ORDER[y.severity] ?? 2)),
    [data],
  );

  const handleResolve = async (id) => {
    const origin = document.activeElement; // el botón pulsado, antes de que la fila desaparezca
    setError('');
    try {
      await guardedUpdate('Alert', id, { resolved: true });
      celebrate(origin);
      invalidate('Alert');
    } catch (err) {
      setError('No se pudo marcar la alerta como resuelta. Inténtalo de nuevo.');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      await invokeFunction('generateAlerts', {});
      invalidate('Alert');
    } catch (err) {
      setError(err?.message || 'No se pudieron verificar las alertas. Inténtalo de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Alertas"
        subtitle={`${alerts.length} activas`}
        action={(
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generando...' : 'Verificar ahora'}
          </Button>
        )}
      />

      {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 text-sm text-destructive">{error}</div>}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-4">
        {[
          { id: 'all', label: `Todas (${alerts.length})` },
          { id: 'critical', label: `Críticas (${alerts.filter(a => a.severity === 'critical').length})` },
          { id: 'warning', label: `Avisos (${alerts.filter(a => a.severity === 'warning').length})` },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${filter === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : (
        <div className="space-y-2">
          {filtered.map(alert => {
            const { icon: Icon, cls, label } = severityConfig[alert.severity] || severityConfig.info;
            return (
              <div key={alert.id} className={`bg-card border rounded-xl p-4 flex items-start gap-3 ${cls.includes('border') ? '' : 'border-border'}`}
                style={{ borderColor: alert.severity === 'critical' ? 'rgba(239,68,68,0.2)' : alert.severity === 'warning' ? 'rgba(245,158,11,0.2)' : undefined }}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cls}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.message}</p>
                  {alert.due_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">Vence: {alert.due_date}</p>
                  )}
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1.5 ${cls}`}>{label}</span>
                </div>
                <button
                  onClick={() => handleResolve(alert.id)}
                  className="shrink-0 text-muted-foreground hover:text-success transition-colors"
                  title="Marcar como resuelta"
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <EmptyState
              icon={CheckCircle2}
              title="Todo en orden"
              description={filter === 'all' ? 'No hay alertas activas en tu flotilla.' : 'No hay alertas de esta categoría.'}
            />
          )}
        </div>
      )}
    </div>
  );
}