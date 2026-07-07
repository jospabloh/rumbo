import { useState } from 'react';
import { ListChecks, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Elige qué unidades se muestran en la matriz/ranking/tarjetas de Reportes
 * (hasta ~100 por tenant). Guarda el OCULTO por usuario vía useUnitVisibility
 * — aquí solo se renderiza la lista y se dispara el toggle.
 *
 * @param {{ vehicles: any[], hiddenIds: string[], onToggle: (id:string)=>void, onSetHidden: (ids:string[])=>void }} props
 */
export default function UnitVisibilitySelector({ vehicles, hiddenIds, onToggle, onSetHidden }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const visibleCount = vehicles.length - hiddenIds.length;

  const filtered = vehicles.filter((v) =>
    `${v.plate || ''} ${v.unit_number || ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ListChecks className="w-3.5 h-3.5" />{visibleCount} de {vehicles.length} unidades visibles
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar unidad..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-background" />
        </div>
        <div className="flex gap-2 mb-2">
          <button className="text-xs text-primary hover:underline" onClick={() => onSetHidden([])}>Mostrar todas</button>
          <span className="text-xs text-muted-foreground">·</span>
          <button className="text-xs text-primary hover:underline" onClick={() => onSetHidden(vehicles.map((v) => v.id))}>Ocultar todas</button>
        </div>
        <div className="max-h-72 overflow-y-auto space-y-0.5">
          {filtered.map((v) => {
            const checked = !hiddenIds.includes(v.id);
            return (
              <label key={v.id} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm">
                <input type="checkbox" checked={checked} onChange={() => onToggle(v.id)} className="accent-primary" />
                <span className="truncate">{v.plate || `#${v.unit_number}` || 'Unidad'}</span>
              </label>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
