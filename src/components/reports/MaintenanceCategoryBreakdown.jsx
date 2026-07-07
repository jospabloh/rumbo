import { EmptyState } from '@/components/ui/empty-state';
import { Wrench } from 'lucide-react';

const KIND_LABEL = { preventive: 'Preventivo', corrective: 'Correctivo', major_repair: 'Arreglo mayor' };
const KIND_COLOR = { preventive: 'hsl(var(--primary))', corrective: 'hsl(var(--warning))', major_repair: 'hsl(var(--critical))' };
const CATEGORY_LABEL = { general: 'General', engine: 'Motor', brakes: 'Frenos', electrical: 'Eléctrico', tires: 'Llantas', body: 'Carrocería', other: 'Otro' };

function Stack({ rows, colorOf, labelOf }) {
  const total = rows.reduce((s, r) => s + r.cost, 0);
  if (total <= 0) return null;
  return (
    <>
      <div className="flex h-5 rounded-md overflow-hidden mb-2">
        {rows.filter((r) => r.cost > 0).map((r) => (
          <div key={r.key} style={{ width: `${(r.cost / total) * 100}%`, background: colorOf(r.key) }} title={`${labelOf(r.key)} $${Math.round(r.cost).toLocaleString()}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {rows.filter((r) => r.cost > 0).map((r) => (
          <span key={r.key} className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorOf(r.key) }} />
            {labelOf(r.key)} · ${Math.round(r.cost).toLocaleString()}
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * Desglose de costo de mantenimiento de la flota por tipo (preventivo /
 * correctivo / arreglo mayor) y por categoría (incl. llantas), en el rango
 * seleccionado.
 *
 * @param {{ byKind: {kind:string,cost:number}[], byCategory: {category:string,cost:number}[] }} props
 */
export default function MaintenanceCategoryBreakdown({ byKind = [], byCategory = [] }) {
  const totalCost = byKind.reduce((s, r) => s + r.cost, 0);
  if (totalCost <= 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-2">Mantenimiento de flota</h3>
        <EmptyState icon={Wrench} title="Sin mantenimientos en este rango" className="py-6" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-2">Mantenimiento por tipo</h3>
        <Stack
          rows={byKind.map((r) => ({ key: r.kind, cost: r.cost }))}
          colorOf={(k) => KIND_COLOR[k] || 'hsl(var(--muted-foreground))'}
          labelOf={(k) => KIND_LABEL[k] || k}
        />
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2">Por categoría</h3>
        <Stack
          rows={byCategory.map((r) => ({ key: r.category, cost: r.cost }))}
          colorOf={(k) => (k === 'tires' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground)/.5)')}
          labelOf={(k) => CATEGORY_LABEL[k] || k}
        />
      </div>
    </div>
  );
}
