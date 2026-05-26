import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Download, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DRIVER_COLUMNS = ['nombre', 'licencia', 'vencimiento_licencia', 'vencimiento_medico', 'telefono', 'fecha_contratacion'];
const VEHICLE_COLUMNS = ['placa', 'marca', 'modelo', 'año', 'vin', 'conductor_asignado'];

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

function downloadCSV(columns, filename) {
  const header = columns.join(',');
  const example = columns.map(() => '...').join(',');
  const csv = `${header}\n${example}`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Import() {
  const [importType, setImportType] = useState('drivers');
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      const columns = importType === 'drivers' ? DRIVER_COLUMNS : VEHICLE_COLUMNS;
      const errs = [];
      rows.forEach((row, i) => {
        columns.slice(0, 1).forEach(col => {
          if (!row[col]) errs.push(`Fila ${i + 2}: campo "${col}" vacío`);
        });
      });
      setErrors(errs);
      setPreview(rows);
      setResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!preview || errors.length > 0) return;
    setImporting(true);
    let count = 0;
    for (const row of preview) {
      if (importType === 'drivers') {
        await base44.entities.Driver.create({
          full_name: row['nombre'],
          license_no: row['licencia'],
          license_expiry: row['vencimiento_licencia'] || null,
          medical_cert_expiry: row['vencimiento_medico'] || null,
          phone: row['telefono'] || null,
          hire_date: row['fecha_contratacion'] || null,
          status: 'active',
        });
      } else {
        await base44.entities.Vehicle.create({
          plate: row['placa']?.toUpperCase(),
          make: row['marca'],
          model: row['modelo'],
          year: row['año'] ? parseInt(row['año']) : null,
          vin: row['vin'],
          status: 'active',
        });
      }
      count++;
    }
    setResult({ count });
    setPreview(null);
    setImporting(false);
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold">Importar datos</h1>
        <p className="text-sm text-muted-foreground">Importa conductores o vehículos desde un archivo CSV</p>
      </div>

      {/* Type selector */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-5 w-fit">
        {['drivers', 'vehicles'].map(t => (
          <button key={t} onClick={() => { setImportType(t); setPreview(null); setErrors([]); setResult(null); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${importType === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {t === 'drivers' ? 'Conductores' : 'Vehículos'}
          </button>
        ))}
      </div>

      {/* Download template */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Plantilla CSV — {importType === 'drivers' ? 'Conductores' : 'Vehículos'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Columnas: {(importType === 'drivers' ? DRIVER_COLUMNS : VEHICLE_COLUMNS).join(', ')}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => downloadCSV(importType === 'drivers' ? DRIVER_COLUMNS : VEHICLE_COLUMNS, `plantilla_${importType}.csv`)} className="gap-2 shrink-0">
            <Download className="w-4 h-4" />Descargar
          </Button>
        </div>
      </div>

      {/* Upload area */}
      {!preview && !result && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors">
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Sube tu archivo CSV</p>
          <p className="text-xs text-muted-foreground mt-1">Haz clic aquí para seleccionar</p>
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{preview.length} registros</span>
            </div>
            <button onClick={() => { setPreview(null); setErrors([]); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted">
                  {(importType === 'drivers' ? DRIVER_COLUMNS : VEHICLE_COLUMNS).map(c => (
                    <th key={c} className="px-3 py-2 text-left font-medium text-muted-foreground">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {(importType === 'drivers' ? DRIVER_COLUMNS : VEHICLE_COLUMNS).map(c => (
                      <td key={c} className="px-3 py-2">{row[c] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && <p className="text-xs text-muted-foreground px-3 py-2">+{preview.length - 5} más...</p>}
          </div>
          {errors.length > 0 && (
            <div className="px-4 py-3 border-t border-destructive/20 bg-destructive/5">
              {errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
            </div>
          )}
          <div className="px-4 py-3 border-t border-border">
            <Button onClick={handleImport} disabled={importing || errors.length > 0} className="w-full">
              {importing ? 'Importando...' : `Confirmar importación de ${preview.length} registros`}
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-5 text-center">
          <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
          <p className="font-semibold">{result.count} registros importados</p>
          <Button size="sm" variant="outline" onClick={() => setResult(null)} className="mt-3">Importar más</Button>
        </div>
      )}
    </div>
  );
}