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
    medical_cert_expiry: driver?.medical_cert_expiry || '',
    background_check_date: driver?.background_check_date || '',
    hire_date: driver?.hire_date || '',
    phone: driver?.phone || '',
    rating: driver?.rating || '',
    status: driver?.status || 'active',
    photo_url: driver?.photo_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, rating: form.rating ? parseFloat(form.rating) : null });
    setSaving(false);
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
              <Label>Venc. cert. médico</Label>
              <Input type="date" value={form.medical_cert_expiry} onChange={e => set('medical_cert_expiry', e.target.value)} className="mt-1 bg-background" />
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
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={saving || uploading} className="flex-1">
              {saving ? 'Guardando...' : driver ? 'Guardar cambios' : 'Crear conductor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}