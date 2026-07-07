import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlerts } from '@/hooks/useEntities';

/**
 * Aviso de saldos de renta trasladados a la semana en curso — Alert
 * (entity_type: 'rent_balance') creadas por generatePeriodCharges en Rentas.jsx
 * cuando una unidad no liquida su renta completa y el remanente se suma a la
 * siguiente.
 */
export default function RentArrearsBanner() {
  const { data: alerts = [] } = useAlerts({ filter: { entity_type: 'rent_balance', resolved: false } });
  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-warning/10 border border-warning/30 rounded-xl px-4 py-2.5 mb-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <p className="text-sm">
          <b>{alerts.length}</b> unidad{alerts.length === 1 ? '' : 'es'} arrastra{alerts.length === 1 ? '' : 'n'} saldo de renta a esta semana
          {': '}
          {alerts.slice(0, 3).map((a, i) => (
            <span key={a.id}>{i > 0 && ' · '}{a.message}</span>
          ))}
          {alerts.length > 3 && ` y ${alerts.length - 3} más`}
        </p>
      </div>
      {/* Stacks below the (possibly multi-line) message on mobile instead of
          floating vertically centered mid-paragraph next to wrapped text. */}
      <Link to="/rentas" className="shrink-0">
        <Button size="sm" variant="outline" className="w-full sm:w-auto">Ver en Rentas</Button>
      </Link>
    </div>
  );
}
