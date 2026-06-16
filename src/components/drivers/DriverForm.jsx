import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/lib/imageUtils';

export default function DriverForm({ driver, onSave, onClose }) {
  const [form, setForm] = useState({
    full_name: driver?.full_name || '',
    license_no: driver?.license_no || '',
    license_expiry: driver?.license_expiry || '',
    background_check_date: driver?.background_check_date || '',
    hire_date: driver?.hire_date || '',
    phone: driver?.phone || '',
    rating: driver?.rating || '',
    status: driver?.status || 'active',
    photo_url: driver?.photo_url || '',
    license_file_url: driver?.license_file_url || '',
    ine_file_url: driver?.ine_file_url || '',
    address_proof_file_url: driver?.address_proof_file_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingField, setUploadingField] = useState('');
  const [error, setError] = useState('');

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
    set('photo_url', file_url);
    setUploading(false);
  };

  // Documentos (licencia, INE, comprobante): se suben tal cual para preservar PDFs.
  const handleDocFile = async (field, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingField(field);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set(field, file_url);
    } catch (err) {
      setError('No se pudo subir el archivo. Inténtalo de nuevo.');
    } finally {
      setUploadingField('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, rating: form.rating ? parseFloat(form.rating) : null });
      // onSave cierra el formulario al tener éxito; no reseteamos saving aquí.
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el conductor. Revisa tu conexión e inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{driver ? 'Editar conductor' : 'Nuevo conductor'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nombre completo *</Label>
              <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} required className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>No. de licencia</Label>
              <Input value={form.license_no} onChange={e => set('license_no', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Venc. licencia</Label>
              <Input type="date" value={form.license_expiry} onChange={e => set('license_expiry', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Fecha de antecedentes</Label>
              <Input type="date" value={form.background_check_date} onChange={e => set('background_check_date', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Fecha de contratación</Label>
              <Input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Calificación (0-5)</Label>
              <Input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={e => set('rating', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Foto</Label>
              <label className="mt-1 flex items-center gap-2 cursor-pointer bg-background border border-input rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Upload className="w-4 h-4" />
                {uploading ? 'Subiendo...' : form.photo_url ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
              </label>
            </div>
          </div>

          {/* Documentos del conductor */}
          <div className="space-y-2 pt-1">
            <Label className="text-sm">Documentos</Label>
            {[
              { field: 'license_file_url', label: 'Licencia' },
              { field: 'ine_file_url', label: 'INE' },
              { field: 'address_proof_file_url', label: 'Comprobante de domicilio' },
            ].map(({ field, label }) => (
              <div key={field} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-44 shrink-0">{label}</span>
                {form[field] && (
                  <a href={form[field]} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline shrink-0">Ver</a>
                )}
                <label className="ml-auto flex items-center gap-2 cursor-pointer bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingField === field ? 'Subiendo...' : form[field] ? 'Cambiar' : 'Subir'}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleDocFile(field, e)} disabled={!!uploadingField} />
                </label>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={saving || uploading || !!uploadingField} className="flex-1">
              {saving ? 'Guardando...' : driver ? 'Guardar cambios' : 'Crear conductor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}