import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Download, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useTenant } from '@/lib/TenantContext';
import { useInvalidateEntity } from '@/hooks/useEntities';
import { parseCSV, partitionRows, IMPORT_COLUMNS } from '@/lib/csv';

function downloadCSV(columns, filename) {
  const csv = `${columns.join(',')}\n${columns.map(() => '...').join(',')}`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Import() {
  const { tenantId, readOnly } = useTenant();
  const invalidate = useInvalidateEntity();
  const [importType, setImportType] = useState('drivers');
  const [parsed, setParsed] = useState(null); // { valid, invalid }
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { imported, failed: [{line, reason}] }
  const [importError, setImportError] = useState('');

  const columns = IMPORT_COLUMNS[importType];

  const reset = () => { setParsed(null); setResult(null); setImportError(''); };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows } = parseCSV(String(ev.target.result));
      setParsed(partitionRows(importType, rows));
      setResult(null);
      setImportError('');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const buildPayload = (row) => importType === 'drivers'
    ? {
        tenant_id: tenantId,
        full_name: row['nombre'],
        license_no: row['licencia'] || null,
        license_expiry: row['vencimiento_licencia'] || null,
        phone: row['telefono'] || null,
        hire_date: row['fecha_contratacion'] || null,
        status: 'active',
      }
    : {
        tenant_id: tenantId,
        unit_number: row['no_unidad'] || null,
        plate: row['placa']?.toUpperCase() || null,
        make: row['marca'] || null,
        model: row['modelo'] || null,
        year: row['año'] ? parseInt(row['año']) : null,
        vin: row['vin'] || null,
        status: 'active',
      };

  const handleImport = async () => {
    if (!parsed || parsed.valid.length === 0) return;
    if (readOnly) { setImportError('Licencia en modo solo lectura: renueva tu pago para importar.'); return; }
    if (!tenantId) { setImportError('Tu organización aún se está configurando. Espera unos segundos e inténtalo de nuevo.'); return; }
    setImporting(true);
    setImportError('');
    const entity = importType === 'drivers' ? base44.entities.Driver : base44.entities.Vehicle;
    const failed = [];
    let imported = 0;
    // Importación fila por fila: una fila mala no detiene a las demás (éxito parcial).
    for (let i = 0; i < parsed.valid.length; i++) {
      try {
        await entity.create(buildPayload(parsed.valid[i]));
        imported++;
      } catch (e) {
        failed.push({ line: i + 1, reason: e?.message || 'error al guardar' });
      }
    }
    invalidate(importType === 'drivers' ? 'Driver' : 'Vehicle');
    setResult({ imported, failed, skipped: parsed.invalid.length });
    setParsed(null);
    setImporting(false);
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      <PageHeader title="Importar datos" subtitle="Importa conductores o vehículos desde un archivo CSV" />

      {/* Type selector */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-5 w-fit">
        {['drivers', 'vehicles'].map(t => (
          <button key={t} onClick={() => { setImportType(t); reset(); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${importType === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {t === 'drivers' ? 'Conductores' : 'Vehículos'}
          </button>
        ))}
      </div>

      {/* Download template */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm">Plantilla CSV — {importType === 'drivers' ? 'Conductores' : 'Vehículos'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Columnas: {columns.join(', ')}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => downloadCSV(columns, `plantilla_${importType}.csv`)} className="gap-2 shrink-0">
            <Download className="w-4 h-4" />Descargar
          </Button>
        </div>
      </div>

      {/* Upload area */}
      {!parsed && !result && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors">
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Sube tu archivo CSV</p>
          <p className="text-xs text-muted-foreground mt-1">Haz clic aquí para seleccionar</p>
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      )}

      {/* Preview */}
      {parsed && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{parsed.valid.length} válidos</span>
              {parsed.invalid.length > 0 && (
                <span className="text-sm text-warning">· {parsed.invalid.length} con problemas</span>
              )}
            </div>
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>

          {/* Vista previa de filas válidas */}
          {parsed.valid.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    {columns.map(c => <th key={c} className="px-3 py-2 text-left font-medium text-muted-foreground">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parsed.valid.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {columns.map(c => <td key={c} className="px-3 py-2">{row[c] || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.valid.length > 5 && <p className="text-xs text-muted-foreground px-3 py-2">+{parsed.valid.length - 5} más...</p>}
            </div>
          )}

          {/* Problemas por fila */}
          {parsed.invalid.length > 0 && (
            <div className="px-4 py-3 border-t border-warning/20 bg-warning/5 space-y-0.5 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-warning flex items-center gap-1 mb-1"><AlertTriangle className="w-3.5 h-3.5" />Estas filas se omitirán:</p>
              {parsed.invalid.slice(0, 20).map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">Fila {e.line}: {e.errors.join(', ')}</p>
              ))}
              {parsed.invalid.length > 20 && <p className="text-xs text-muted-foreground">+{parsed.invalid.length - 20} más…</p>}
            </div>
          )}

          <div className="px-4 py-3 border-t border-border">
            {importError && <p className="text-xs text-destructive mb-2">{importError}</p>}
            <Button onClick={handleImport} disabled={importing || parsed.valid.length === 0 || readOnly} className="w-full">
              {importing ? 'Importando...' : readOnly ? 'Solo lectura' : `Importar ${parsed.valid.length} registro${parsed.valid.length === 1 ? '' : 's'} válido${parsed.valid.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-center">
            <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="font-semibold">{result.imported} registro{result.imported === 1 ? '' : 's'} importado{result.imported === 1 ? '' : 's'}</p>
            {(result.skipped > 0 || result.failed.length > 0) && (
              <p className="text-sm text-muted-foreground mt-1">
                {result.skipped > 0 && `${result.skipped} omitido${result.skipped === 1 ? '' : 's'} por validación`}
                {result.skipped > 0 && result.failed.length > 0 && ' · '}
                {result.failed.length > 0 && `${result.failed.length} fallaron al guardar`}
              </p>
            )}
          </div>
          {result.failed.length > 0 && (
            <div className="mt-3 border-t border-border pt-3 space-y-0.5 max-h-40 overflow-y-auto">
              {result.failed.map((f, i) => (
                <p key={i} className="text-xs text-destructive">Registro {f.line}: {f.reason}</p>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" onClick={reset} className="mt-4 w-full">Importar más</Button>
        </div>
      )}
    </div>
  );
}
