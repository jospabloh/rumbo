import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, CheckCircle2, AlertCircle, Loader2, Users, Truck, Bell, Wrench } from 'lucide-react';

export default function TestDataPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCreateTestData = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await base44.functions.invoke('createTestData', {});
      if (response.data?.success) {
        setResult({ success: true, summary: response.data.summary });
      } else {
        setError(response.data?.error || 'Error al crear datos de prueba');
      }
    } catch (err) {
      setError(err.message || 'Error al crear datos de prueba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Generar Datos de Prueba</h1>
            <p className="text-muted-foreground mt-1">
              Entorno: <span className="text-warning font-medium">TEST (base de datos de prueba)</span>
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Generar datos de prueba
            </CardTitle>
            <CardDescription>
              Esta acción creará vehículos, conductores, alertas, mantenimientos, multas y viajes de prueba
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                <Truck className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">5 Vehículos</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">5 Conductores</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                <Bell className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">2 Alertas</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                <Wrench className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Mantenimientos, multas, viajes</span>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {result && (
              <div className="p-4 bg-success/10 border border-success/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <p className="text-sm font-medium text-success">Datos creados exitosamente</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{result.summary.vehicles}</p>
                    <p className="text-xs text-muted-foreground">Vehículos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{result.summary.drivers}</p>
                    <p className="text-xs text-muted-foreground">Conductores</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{result.summary.alerts}</p>
                    <p className="text-xs text-muted-foreground">Alertas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{result.summary.trips}</p>
                    <p className="text-xs text-muted-foreground">Viajes</p>
                  </div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleCreateTestData} 
              disabled={loading || !!result}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando datos...
                </>
              ) : result ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Datos creados
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Generar datos de prueba
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Los datos se crean en la base de datos TEST (entorno de pruebas)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}