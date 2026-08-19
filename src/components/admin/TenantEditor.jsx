import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Edit2, Save, Palette, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PalettePresets from '@/components/admin/PalettePresets';

export default function TenantEditor({ license, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    tenant_name: license?.tenant_name || '',
    slogan: license?.slogan || '',
    logo_url: license?.logo_url || '',
    owner_email: license?.owner_email || '',
    notes: license?.notes || '',
    color_primary: license?.color_primary || '',
    color_secondary: license?.color_secondary || '',
    color_accent: license?.color_accent || '',
    color_background: license?.color_background || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [logoError, setLogoError] = useState('');

  // Sugiere una paleta de 4 colores de marca analizando el logo con IA.
  const suggestColors = async (fileUrl) => {
    if (!fileUrl) return;
    setExtracting(true);
    setLogoError('');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analiza este logo y extrae una paleta de 4 colores en hex que representen la marca:
1. primary: el color más dominante/destacado del logo
2. secondary: color de apoyo o secundario
3. accent: color de acento o contraste
4. background: color de fondo apropiado (oscuro si el logo es claro, viceversa)

Responde SOLO el JSON con los 4 colores en formato hex (#RRGGBB). No incluyas texto adicional.`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: 'object',
          properties: {
            primary: { type: 'string' },
            secondary: { type: 'string' },
            accent: { type: 'string' },
            background: { type: 'string' },
          }
        }
      });
      const c = /** @type {{ primary?: string; secondary?: string; accent?: string; background?: string }} */ (result);
      setForm(f => ({
        ...f,
        color_primary: c.primary || f.color_primary,
        color_secondary: c.secondary || f.color_secondary,
        color_accent: c.accent || f.color_accent,
        color_background: c.background || f.color_background,
      }));
    } catch {
      setLogoError('No se pudieron sugerir los colores. Ajústalos manualmente.');
    } finally {
      setExtracting(false);
    }
  };

  // Sube el logo (SVG/PNG/JPG) desde el dispositivo y dispara la sugerencia de colores.
  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setLogoError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, logo_url: file_url }));
      await suggestColors(file_url);
    } catch {
      setLogoError('No se pudo subir el logo. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    if (license?.id) {
      await base44.entities.TenantLicense.update(license.id, form);
    } else {
      // plan/status ya no se envían explícitamente: son rls.write:false (auditoría
      // 2026-08-19, módulo 1) — el esquema de la entidad ya declara sus defaults
      // ("trial"/"active"), que Base44 aplica igual al omitirlos.
      await base44.entities.TenantLicense.create({ ...form });
    }
    setSaving(false);
    setEditing(false);
    onSaved();
  };

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          {license?.logo_url && <img src={license.logo_url} alt="logo" className="h-10 object-contain mb-1" />}
          <p className="text-sm font-semibold text-foreground">{license?.tenant_name || <span className="text-muted-foreground italic">Sin nombre</span>}</p>
          {license?.slogan && <p className="text-xs text-muted-foreground italic">{license.slogan}</p>}
          {license?.owner_email && <p className="text-xs text-muted-foreground">{license.owner_email}</p>}
          {(license?.color_primary || license?.color_secondary || license?.color_accent || license?.color_background) && (
            <div className="flex gap-1.5 mt-1">
              {[license.color_primary, license.color_secondary, license.color_accent, license.color_background].filter(Boolean).map((c, i) => (
                <div key={i} className="w-5 h-5 rounded-full border border-border" style={{ background: c }} title={c} />
              ))}
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => setEditing(true)}>
          <Edit2 className="w-3.5 h-3.5" /> Editar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nombre de la organización</label>
          <Input value={form.tenant_name} onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))} className="bg-secondary border-border text-sm h-8" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Slogan</label>
          <Input value={form.slogan} onChange={e => setForm(f => ({ ...f, slogan: e.target.value }))} className="bg-secondary border-border text-sm h-8" placeholder="Movilidad que conecta" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Email del owner</label>
          <Input value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} className="bg-secondary border-border text-sm h-8" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Logo</label>
          <div className="flex items-center gap-3 flex-wrap">
            <label className={`flex items-center gap-2 border-2 border-dashed border-border rounded-lg px-3 py-2 cursor-pointer hover:border-primary/50 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" className="h-8 object-contain" />
              ) : (
                <Upload className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {uploading ? 'Subiendo...' : form.logo_url ? 'Cambiar logo' : 'Subir logo (SVG, PNG o JPG)'}
              </span>
              <input
                type="file"
                accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                className="hidden"
                onChange={handleLogoFile}
                disabled={uploading}
              />
            </label>
            {form.logo_url && (
              <Button
                size="sm"
                variant="outline"
                type="button"
                className="h-8 gap-1.5 text-xs"
                onClick={() => suggestColors(form.logo_url)}
                disabled={extracting || uploading}
              >
                {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palette className="w-3.5 h-3.5" />}
                {extracting ? 'Sugiriendo...' : 'Sugerir colores del logo'}
              </Button>
            )}
          </div>
          <Input
            value={form.logo_url}
            onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            className="bg-secondary border-border text-xs h-7 mt-2"
            placeholder="…o pega una URL: https://..."
          />
          {logoError && <p className="text-xs text-destructive mt-1">{logoError}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
            <Palette className="w-3 h-3" /> Colores de la marca (hex)
            {extracting && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          </label>
          <div className="mb-3">
            <PalettePresets onSelect={(p) => setForm(f => ({
              ...f,
              color_primary: p.primary,
              color_secondary: p.secondary,
              color_accent: p.accent,
              color_background: p.background,
            }))} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'color_primary', label: 'Principal' },
              { key: 'color_secondary', label: 'Secundario' },
              { key: 'color_accent', label: 'Acento' },
              { key: 'color_background', label: 'Fondo' },
            ].map(({ key, label }) => (
              <div key={key}>
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-4 h-4 rounded-full border border-border" style={{ background: form[key] || '#888' }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <Input
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="bg-secondary border-border text-xs h-7"
                  placeholder="#000000"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Notas internas</label>
          <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-secondary border-border text-sm h-8" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="gap-2">
          <Save className="w-3.5 h-3.5" /> Guardar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
