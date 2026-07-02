import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Download, CheckCircle2, FileText, AlertTriangle, Copy, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useTenant } from '@/lib/TenantContext';
import { useInvalidateEntity } from '@/hooks/useEntities';
import { parseCSV, analyzeImport, buildTemplate, IMPORT_SPECS, IMPORT_TYPES } from '@/lib/csv';

/** Dispara la descarga de un archivo de texto en el navegador. */
function downloadText(content, filename, type = 'text/csv;charset=utf-8') {
  // Prefijo BOM para que Excel respete los acentos.
  const blob = new Blob(['﻿' + content], { type });
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
  const [analysis, setAnalysis] = useState(null); // resultado de analyzeImport
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { imported, failed:[{line,reason,fix}], skippedExisting, skippedInFile, skippedInvalid, examples }
  const [error, setError] = useState('');
  const [dedupWarning, setDedupWarning] = useState('');

  const spec = IMPORT_SPECS[importType];

  const reset = () => { setAnalysis(null); setResult(null); setError(''); setDedupWarning(''); };

  const selectType = (t) => { setImportType(t); reset(); };

  const downloadTemplate = () => {
    downloadText(buildTemplate(importType), `plantilla_${importType}.csv`);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setResult(null);
    setDedupWarning('');
    setLoadingFile(true);
    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      if (rows.length === 0) {
        setError('El archivo no tiene filas de datos. Descarga la plantilla, llénala debajo de la fila de ejemplo y vuelve a subirla.');
        setLoadingFile(false);
        return;
      }
      // Para no crear duplicados comparamos contra lo que ya existe en el tenant.
      let existing = [];
      try {
        existing = await base44.entities[spec.entity].filter({ tenant_id: tenantId }, null, 5000);
      } catch (err) {
        // Si no se pudo leer lo existente, seguimos: deduplicamos al menos dentro del archivo.
        setDedupWarning('No se pudieron leer los registros actuales para comparar; se evitarán duplicados dentro de este archivo, pero verifica que no existieran antes.');
      }
      setAnalysis(analyzeImport(importType, rows, existing));
    } catch (err) {
      setError('No se pudo leer el archivo. Asegúrate de que sea un CSV válido (puedes exportarlo desde Excel o Google Sheets).');
    } finally {
      setLoadingFile(false);
    }
  };

  const handleImport = async () => {
    if (!analysis || analysis.toImport.length === 0) return;
    if (readOnly) { setError('Tu licencia está en modo solo lectura: renueva tu pago para importar.'); return; }
    if (!tenantId) { setError('Tu organización aún se está configurando. Espera unos segundos e inténtalo de nuevo.'); return; }
    setImporting(true);
    setError('');
    const entity = base44.entities[spec.entity];
    const failed = [];
    let imported = 0;
    // Importación fila por fila: una fila mala no detiene a las demás (éxito parcial).
    for (const item of analysis.toImport) {
      try {
        await entity.create(spec.buildPayload(item.row, tenantId));
        imported++;
      } catch (err) {
        failed.push({
          line: item.line,
          reason: err?.message || 'error al guardar',
          fix: 'Revisa que los datos de esa fila sean válidos y que tu licencia permita escribir. Corrige y vuelve a subir solo esa fila.',
        });
      }
    }
    invalidate(spec.entity);
    setResult({
      imported,
      failed,
      skippedExisting: analysis.duplicatesExisting.length,
      skippedInFile: analysis.duplicatesInFile.length,
      skippedInvalid: analysis.invalid.length,
      examples: analysis.examplesSkipped,
    });
    setAnalysis(null);
    setImporting(false);
  };

  const downloadErrorReport = () => {
    if (!analysis) return;
    const lines = [['fila', 'problema', 'como_remediar']];
    analysis.invalid.forEach((e) => {
      e.errors.forEach((err) => lines.push([e.line, err.msg, err.fix]));
    });
    const csv = lines
      .map((r) => r.map((c) => {
        const s = String(c ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
      .join('\n');
    downloadText(csv, `errores_${importType}.csv`);
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      <PageHeader title="Importar datos" subtitle="Migra tu catálogo (conductores, vehículos, refacciones y listas) desde archivos CSV" />

      {/* Selector de tipo */}
      <div className="flex flex-wrap gap-1 bg-muted rounded-lg p-1 mb-5 w-fit">
        {IMPORT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => selectType(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${importType === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            {IMPORT_SPECS[t].label}
          </button>
        ))}
      </div>

      {/* Descargar plantilla */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm">Plantilla CSV — {spec.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Columnas: {spec.columns.join(', ')}</p>
          </div>
          <Button size="sm" variant="outline" onClick={downloadTemplate} className="gap-2 shrink-0">
            <Download className="w-4 h-4" />Descargar
          </Button>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mt-3">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
          <span>
            La plantilla trae una <span className="text-foreground font-medium">fila de ejemplo marcada con “#”</span> que el importador
            ignora automáticamente. Escribe tus filas debajo. Si vuelves a subir el mismo archivo,
            no se crearán duplicados (se comparan por <span className="text-foreground font-medium">{spec.keyLabel}</span>).
          </span>
        </div>
      </div>

      {/* Zona de carga */}
      {!analysis && !result && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors">
          {loadingFile ? <Loader2 className="w-8 h-8 text-muted-foreground mb-2 animate-spin" /> : <Upload className="w-8 h-8 text-muted-foreground mb-2" />}
          <p className="text-sm font-medium">{loadingFile ? 'Leyendo archivo…' : 'Sube tu archivo CSV'}</p>
          <p className="text-xs text-muted-foreground mt-1">Haz clic aquí para seleccionar</p>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} disabled={loadingFile} />
        </label>
      )}

      {error && !analysis && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5 mt-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Vista previa del análisis */}
      {analysis && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{analysis.toImport.length} listos para importar</span>
              {analysis.duplicatesExisting.length > 0 && (
                <span className="text-muted-foreground">· {analysis.duplicatesExisting.length} ya existen</span>
              )}
              {analysis.duplicatesInFile.length > 0 && (
                <span className="text-muted-foreground">· {analysis.duplicatesInFile.length} repetidos en el archivo</span>
              )}
              {analysis.invalid.length > 0 && (
                <span className="text-warning">· {analysis.invalid.length} con problemas</span>
              )}
            </div>
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>

          {analysis.examplesSkipped > 0 && (
            <p className="text-xs text-muted-foreground px-4 py-2 border-b border-border">
              Se ignoró {analysis.examplesSkipped} fila de ejemplo (marcada con “#”).
            </p>
          )}

          {dedupWarning && (
            <p className="text-xs text-warning bg-warning/5 px-4 py-2 border-b border-warning/20">{dedupWarning}</p>
          )}

          {/* Vista previa de filas a importar */}
          {analysis.toImport.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    {spec.columns.map((c) => <th key={c} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {analysis.toImport.slice(0, 5).map((item, i) => (
                    <tr key={i} className="border-t border-border">
                      {spec.columns.map((c) => <td key={c} className="px-3 py-2 whitespace-nowrap">{item.row[c] || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {analysis.toImport.length > 5 && <p className="text-xs text-muted-foreground px-3 py-2">+{analysis.toImport.length - 5} más…</p>}
            </div>
          )}

          {/* Duplicados que ya existen (se omitirán) */}
          {analysis.duplicatesExisting.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-1">Ya existen — se omitirán para no duplicar:</p>
              <p className="text-xs text-muted-foreground">
                Filas {analysis.duplicatesExisting.slice(0, 30).map((d) => d.line).join(', ')}
                {analysis.duplicatesExisting.length > 30 ? '…' : ''}
              </p>
            </div>
          )}

          {/* Problemas por fila, con cómo remediar */}
          {analysis.invalid.length > 0 && (
            <div className="px-4 py-3 border-t border-warning/20 bg-warning/5 space-y-1.5 max-h-52 overflow-y-auto">
              <p className="text-xs font-medium text-warning flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Estas filas se omitirán — corrígelas y vuelve a subir:</p>
              {analysis.invalid.slice(0, 20).map((e, i) => (
                <div key={i} className="text-xs">
                  <p className="text-foreground font-medium">Fila {e.line}: {e.errors.map((x) => x.msg).join(', ')}</p>
                  <p className="text-muted-foreground">↳ {e.errors.map((x) => x.fix).join(' ')}</p>
                </div>
              ))}
              {analysis.invalid.length > 20 && <p className="text-xs text-muted-foreground">+{analysis.invalid.length - 20} más…</p>}
              <Button size="sm" variant="outline" onClick={downloadErrorReport} className="gap-2 mt-1">
                <Download className="w-3.5 h-3.5" />Descargar reporte de errores
              </Button>
            </div>
          )}

          <div className="px-4 py-3 border-t border-border">
            {error && <p className="text-xs text-destructive mb-2">{error}</p>}
            {analysis.toImport.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">
                No hay filas nuevas para importar. {analysis.duplicatesExisting.length > 0 && 'Todo lo del archivo ya existía. '}
                {analysis.invalid.length > 0 && 'Corrige las filas con problemas y vuelve a subir el archivo.'}
              </p>
            ) : (
              <Button onClick={handleImport} disabled={importing || readOnly} className="w-full gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {importing ? 'Importando…' : readOnly ? 'Solo lectura' : `Importar ${analysis.toImport.length} registro${analysis.toImport.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Resultado final */}
      {result && (
        <div className="bg-card border border-border rounded-xl p-5">
          {result.imported > 0 ? (
            <div className="text-center">
              <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
              <p className="font-semibold">¡Listo! Se importaron {result.imported} registro{result.imported === 1 ? '' : 's'}</p>
              <p className="text-sm text-muted-foreground mt-1">Ya están disponibles para tu organización en {spec.label}.</p>
            </div>
          ) : (
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
              <p className="font-semibold">No se importó ningún registro nuevo</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.skippedExisting > 0 && 'Todo lo del archivo ya existía en tu organización. '}
                {result.failed.length > 0 && 'Hubo errores al guardar (ver abajo). '}
                {result.skippedInvalid > 0 && 'Algunas filas tenían problemas de validación. '}
              </p>
            </div>
          )}

          {/* Desglose */}
          {(result.skippedExisting > 0 || result.skippedInFile > 0 || result.skippedInvalid > 0 || result.examples > 0) && (
            <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground space-y-0.5">
              {result.skippedExisting > 0 && <p>· {result.skippedExisting} omitido{result.skippedExisting === 1 ? '' : 's'} porque ya existía{result.skippedExisting === 1 ? '' : 'n'} (sin duplicar).</p>}
              {result.skippedInFile > 0 && <p>· {result.skippedInFile} omitido{result.skippedInFile === 1 ? '' : 's'} por estar repetido{result.skippedInFile === 1 ? '' : 's'} dentro del archivo.</p>}
              {result.skippedInvalid > 0 && <p>· {result.skippedInvalid} omitido{result.skippedInvalid === 1 ? '' : 's'} por problemas de validación.</p>}
              {result.examples > 0 && <p>· {result.examples} fila de ejemplo ignorada.</p>}
            </div>
          )}

          {/* Fallos al guardar, con remediación */}
          {result.failed.length > 0 && (
            <div className="mt-3 border-t border-border pt-3 space-y-1.5 max-h-52 overflow-y-auto">
              <p className="text-xs font-medium text-destructive">Fallaron al guardar:</p>
              {result.failed.map((f, i) => (
                <div key={i} className="text-xs">
                  <p className="text-destructive font-medium">Fila {f.line}: {f.reason}</p>
                  <p className="text-muted-foreground">↳ {f.fix}</p>
                </div>
              ))}
            </div>
          )}

          <Button size="sm" variant="outline" onClick={reset} className="mt-4 w-full gap-2">
            <Copy className="w-3.5 h-3.5" />Importar más
          </Button>
        </div>
      )}
    </div>
  );
}
