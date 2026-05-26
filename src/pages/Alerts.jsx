import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const severityConfig = {
  critical: { icon: AlertTriangle, cls: 'text-destructive bg-destructive/10 border-destructive/20', label: 'Crítica' },
  warning: { icon: AlertCircle, cls: 'text-warning bg-warning/10 border-warning/20', label: 'Aviso' },
  info: { icon: Info, cls: 'text-primary bg-primary/10 border-primary/20', label: 'Info' },
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => {
    base44.entities.Alert.filter({ resolved: false }).then(a => {
      setAlerts(a.sort((x, y) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return (order[x.severity] || 2) - (order[y.severity] || 2);
      }));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleResolve = async (id) => {
    await base44.entities.Alert.update(id, { resolved: true });
    setAlerts(a => a.filter(x => x.id !== id));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await base44.functions.invoke('generateAlerts', {});
    load();
    setGenerating(false);
  };

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Alertas</h1>
          <p className="text-sm text-muted-foreground">{alerts.length} activas</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generando...' : 'Verificar ahora'}
        </Button>
      </div>

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
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
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
            <div className="text-center py-12">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Sin alertas activas</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}