import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/lib/TenantContext';
import { SETTINGS_SCHEMA, SETTINGS_DEFAULTS, getSetting, normalizeSettings } from '@/lib/settings';

/**
 * Configuración de negocio del tenant. El admin/owner edita valores que antes estaban
 * hardcodeados (bono de referido, ventana de costo/km, etc.). Deja el campo vacío para
 * volver al default. Se guarda en TenantLicense.settings (RLS ya permite a owner/admin).
 */
export default function BusinessSettingsPanel() {
  const { tenant, readOnly, reload } = useTenant();
  const [form, setForm] = useState(() => {
    const init = {};
    for (const def of SETTINGS_SCHEMA) {
      const raw = tenant?.settings?.[def.key];
      init[def.key] = raw === undefined || raw === null ? '' : String(raw);
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const save = async () => {
    if (!tenant?.id) { setError('Tu organización aún se está configurando.'); return; }
    setSaving(true); setError(''); setMsg('');
    try {
      await base44.entities.TenantLicense.update(tenant.id, { settings: normalizeSettings(form) });
      setMsg('Configuración guardada.');
      reload();
    } catch (e) {
      setError('No se pudo guardar. Verifica tus permisos e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Configuración del negocio</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Personaliza las reglas de tu operación. Deja un campo vacío para usar el valor por defecto de la app.
      </p>

      <div className="space-y-4">
        {SETTINGS_SCHEMA.map((def) => (
          <div key={def.key}>
            <Label className="text-sm">{def.label}</Label>
            <Input
              type={def.type === 'number' ? 'number' : 'text'}
              min={def.min}
              value={form[def.key]}
              disabled={readOnly}
              onChange={(e) => { setForm((f) => ({ ...f, [def.key]: e.target.value })); setMsg(''); }}
              placeholder={`Default: ${SETTINGS_DEFAULTS[def.key]}`}
              className="mt-1 bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {def.help} <span className="opacity-70">Actual: {getSetting(tenant, def.key)}{form[def.key] === '' ? ' (default)' : ''}</span>
            </p>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-success">{msg}</p>}

      {!readOnly && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</Button>
          <Button
            size="sm" variant="outline"
            onClick={() => { setForm(Object.fromEntries(SETTINGS_SCHEMA.map((d) => [d.key, '']))); setMsg('Se usarán los valores por defecto al guardar.'); }}
            className="gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />Restaurar defaults
          </Button>
        </div>
      )}
    </section>
  );
}
