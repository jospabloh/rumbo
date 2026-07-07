import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { rangeLabel } from '@/lib/fleetMetricsRange';

const OPTIONS = [
  ['week', 'Semana'],
  ['month', 'Mes'],
  ['year', 'Año'],
  ['custom', 'Personalizado'],
];

/**
 * Semana / Mes / Año / Personalizado — controla el rango de toda la página de
 * Reportes (KPIs, matriz y rankings). "Personalizado" abre un calendario de
 * rango (react-day-picker, ya usado en el resto de la app como date-picker).
 *
 * @param {{ type: string, custom: {start:string,end:string}, onChange: (type: string, custom?: object) => void, range: object }} props
 */
export default function RangeSegmentedControl({ type, custom, onChange, range }) {
  const [open, setOpen] = useState(false);
  const selected = custom?.start && custom?.end
    ? { from: new Date(`${custom.start}T00:00:00`), to: new Date(`${custom.end}T00:00:00`) }
    : undefined;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex bg-muted rounded-lg p-1">
        {OPTIONS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => (value === 'custom' ? setOpen(true) : onChange(value))}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              type === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <CalendarRange className="w-3.5 h-3.5" />{rangeLabel(range)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={selected}
            onSelect={(r) => {
              if (r?.from && r?.to) {
                onChange('custom', {
                  start: r.from.toISOString().slice(0, 10),
                  end: r.to.toISOString().slice(0, 10),
                });
                setOpen(false);
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
