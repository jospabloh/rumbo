import { useState } from 'react';
import { invokeFunction } from '@/lib/invokeFunction';
import { Button } from '@/components/ui/button';
import { DollarSign, Calculator } from 'lucide-react';

export default function CostPerKm({ vehicles }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const calculate = async () => {
    setLoading(true);
    // Call backend function for server-side calculation
    const body = await invokeFunction('calculateCostPerKm', {});
    setResults(body?.results || []);
    setCalculated(true);
    setLoading(false);
  };

  return (
    <div>
      <div className="bg-card border border-border rounded-xl p-5 mb-4 text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-3">
          <Calculator className="w-6 h-6" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          El costo/km se calcula en el servidor usando:<br />
          <span className="text-foreground font-medium">(combustible + mantenimiento + multas) ÷ km recorridos</span>
        </p>
        <Button onClick={calculate} disabled={loading} className="gap-2">
          <DollarSign className="w-4 h-4" />
          {loading ? 'Calculando...' : 'Calcular costo/km'}
        </Button>
      </div>

      {calculated && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">Sin datos suficientes para calcular</p>
          ) : (
            results.map(r => (
              <div key={r.vehicle_id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{r.plate}</p>
                    <p className="text-xs text-muted-foreground">{r.km_traveled?.toFixed(0)} km recorridos</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Combustible: ${r.fuel_cost?.toFixed(2)} · Mant: ${r.maintenance_cost?.toFixed(2)} · Multas: ${r.fines_cost?.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">${r.cost_per_km?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">por km</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}