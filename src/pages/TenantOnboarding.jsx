/**
 * Pantalla de onboarding para nuevo tenant.
 * Se muestra cuando un admin/owner aún no tiene TenantLicense.
 * Permite definir nombre, slogan, logo y extrae la paleta de colores del logo via LLM.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Upload, Palette, CheckCircle2, Loader2 } from 'lucide-react';

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function TenantOnboarding({ onComplete }) {
  const [step, setStep] = useState(1); // 1: info, 2: logo+colors, 3: done
  const [form, setForm] = useState({ tenant_name: '', slogan: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [colors, setColors] = useState({ primary: '', secondary: '', accent: '', background: '' });
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
    setColors({ primary: '', secondary: '', accent: '', background: '' });
  };

  const extractColors = async () => {
    if (!logoFile) return;
    setExtracting(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: logoFile });
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analiza este logo y extrae una paleta de 4 colores en hex que representen la marca:
1. primary: el color más dominante/destacado del logo
2. secondary: color de apoyo o secundario
3. accent: color de acento o contraste
4. background: color de fondo apropiado (oscuro si el logo es claro, viceversa)

Responde SOLO el JSON con los 4 colores en formato hex (#RRGGBB). No incluyas texto adicional.`,
        file_urls: [file_url],
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
      const colorResult = /** @type {{ primary?: string; secondary?: string; accent?: string; background?: string }} */ (result);
      setColors({
        primary: colorResult.primary || '#3b82f6',
        secondary: colorResult.secondary || '#64748b',
        accent: colorResult.accent || '#8b5cf6',
        background: colorResult.background || '#0f172a',
      });
    } catch (e) {
      setError('No se pudo extraer los colores. Ingrésalos manualmente.');
      setColors({ primary: '#3b82f6', secondary: '#64748b', accent: '#8b5cf6', background: '#0f172a' });
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.tenant_name.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      const user = await base44.auth.me();
      let logo_url = '';
      if (logoFile) {
        const res = await base44.integrations.Core.UploadFile({ file: logoFile });
        logo_url = res.file_url;
      }
      // Primer mes gratis: la licencia queda vigente hasta hoy + 1 mes.
      const freeUntil = new Date();
      freeUntil.setMonth(freeUntil.getMonth() + 1);
      const freeUntilStr = freeUntil.toISOString().slice(0, 10);
      const tenant = await base44.entities.TenantLicense.create({
        tenant_name: form.tenant_name.trim(),
        slogan: form.slogan.trim(),
        logo_url,
        color_primary: colors.primary,
        color_secondary: colors.secondary,
        color_accent: colors.accent,
        color_background: colors.background,
        plan: 'trial',
        status: 'active',
        owner_email: user.email,
        trial_ends_at: freeUntilStr,
        current_period_end: freeUntilStr,
        billing_cycle: 'monthly',
      });
      // Asociar el tenant recién creado al perfil del usuario. tenant_id es
      // server-authoritative (write:false en RLS), así que la asignación la hace
      // resolveTenant con service role: detecta al creador del TenantLicense y
      // persiste su tenant_id. El cliente ya no puede escribir tenant_id directamente.
      try {
        await base44.functions.invoke('resolveTenant', {});
      } catch (e) {
        console.error('No se pudo asociar el tenant al usuario tras el onboarding:', e);
      }
      // Apply colors to CSS vars
      if (colors.primary) applyTenantColors(colors);
      setStep(3);
      setTimeout(() => onComplete(tenant), 1500);
    } catch (e) {
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-2xl">R</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Bienvenido a Rumbo</h1>
          <p className="text-muted-foreground mt-1">Configura tu organización para comenzar</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className={`h-1.5 w-12 rounded-full transition-all ${step >= s ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {step === 3 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">¡Listo!</h2>
            <p className="text-muted-foreground">Tu organización ha sido configurada.</p>
          </div>
        ) : step === 1 ? (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Información de tu organización</h2>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Nombre de la organización *</label>
              <Input
                placeholder="Ej. Flota Express MX"
                value={form.tenant_name}
                onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))}
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Slogan (opcional)</label>
              <Input
                placeholder="Ej. Movilidad que conecta"
                value={form.slogan}
                onChange={e => setForm(f => ({ ...f, slogan: e.target.value }))}
                className="bg-secondary border-border"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              className="w-full"
              onClick={() => { if (!form.tenant_name.trim()) { setError('El nombre es requerido'); return; } setError(''); setStep(2); }}
            >
              Continuar
            </Button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Logo y colores</h2>
            </div>

            {/* Logo upload */}
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Logo de tu organización</label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 transition-colors">
                {logoPreview ? (
                  <img src={logoPreview} alt="logo preview" className="h-20 object-contain mb-2" />
                ) : (
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                )}
                <span className="text-sm text-muted-foreground">{logoPreview ? 'Cambiar logo' : 'Subir logo'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
            </div>

            {/* Extract colors */}
            {logoPreview && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={extractColors}
                disabled={extracting}
              >
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                {extracting ? 'Extrayendo paleta...' : 'Extraer colores del logo con IA'}
              </Button>
            )}

            {/* Color palette preview */}
            {(colors.primary || colors.secondary || colors.accent || colors.background) && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Paleta de colores</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'primary', label: 'Principal' },
                    { key: 'secondary', label: 'Secundario' },
                    { key: 'accent', label: 'Acento' },
                    { key: 'background', label: 'Fondo' },
                  ].map(({ key, label }) => (
                    <div key={key} className="text-center">
                      <div
                        className="w-full h-10 rounded-lg border border-border mb-1"
                        style={{ background: colors[key] || '#888' }}
                      />
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <input
                        type="text"
                        value={colors[key]}
                        onChange={e => setColors(c => ({ ...c, [key]: e.target.value }))}
                        className="w-full text-xs text-center bg-transparent border-0 text-muted-foreground focus:outline-none"
                        placeholder="#000000"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Atrás</Button>
              <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Guardando...' : 'Finalizar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function applyTenantColors(colors) {
  if (!colors) return;
  const root = document.documentElement;
  if (colors.primary) {
    try {
      const hsl = hexToHsl(colors.primary);
      root.style.setProperty('--primary', hsl);
      root.style.setProperty('--ring', hsl);
      root.style.setProperty('--sidebar-primary', hsl);
      root.style.setProperty('--sidebar-ring', hsl);
    } catch (e) {}
  }
  if (colors.background) {
    try {
      const hsl = hexToHsl(colors.background);
      root.style.setProperty('--background', hsl);
      root.style.setProperty('--sidebar-background', hsl);
    } catch (e) {}
  }
  if (colors.secondary) {
    try {
      const hsl = hexToHsl(colors.secondary);
      root.style.setProperty('--secondary', hsl);
      root.style.setProperty('--muted', hsl);
    } catch (e) {}
  }
}