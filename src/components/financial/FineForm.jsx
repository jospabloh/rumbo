import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/lib/imageUtils';
import { useCatalog } from '@/lib/catalogs';

export default function FineForm({ vehicles, drivers, onSave, onClose }) {
  const fineTypes = useCatalog('fine_type');
  const [form, setForm] = useState({ driver_id: '', vehicle_id: '', fine_type: '', amount: '', points: 0, issued_at: '', paid: false, photo_url: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
    await onSave({ ...form, amount: parseFloat(form.amount) || 0, points: parseInt(form.points) || 0 });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Registrar multa</h2>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Conductor *</Label>
            <Select value={form.driver_id} onValueChange={v => set('driver_id', v)}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vehículo *</Label>
            <Select value={form.vehicle_id} onValueChange={v => set('vehicle_id', v)}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de infracción</Label>
            <Select value={form.fine_type} onValueChange={v => set('fine_type', v)}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{fineTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto ($) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Puntos</Label>
              <Input type="number" value={form.points} onChange={e => set('points', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.issued_at} onChange={e => set('issued_at', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" checked={form.paid} onChange={e => set('paid', e.target.checked)} className="w-4 h-4" />
                <span className="text-sm">Ya pagada</span>
              </label>
            </div>
          </div>
          <div>
            <Label>Foto</Label>
            <label className="mt-1 flex items-center gap-2 cursor-pointer bg-background border border-input rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <Upload className="w-4 h-4" />{uploading ? 'Subiendo...' : form.photo_url ? 'Foto cargada ✓' : 'Subir foto'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
            </label>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={saving || uploading || !form.driver_id || !form.vehicle_id} className="flex-1">{saving ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}