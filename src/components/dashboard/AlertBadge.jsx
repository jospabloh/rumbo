import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const severityConfig = {
  critical: { icon: AlertTriangle, cls: 'text-destructive bg-destructive/10', label: 'Crítica' },
  warning: { icon: AlertCircle, cls: 'text-warning bg-warning/10', label: 'Aviso' },
  info: { icon: Info, cls: 'text-primary bg-primary/10', label: 'Info' },
};

export default function AlertBadge({ alert }) {
  const { icon: Icon, cls, label } = severityConfig[alert.severity] || severityConfig.info;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${cls}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-foreground line-clamp-2">{alert.message}</p>
        {alert.due_date && (
          <p className="text-xs text-muted-foreground mt-0.5">Vence: {alert.due_date}</p>
        )}
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${cls}`}>{label}</span>
    </div>
  );
}