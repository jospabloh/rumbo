import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/lib/imageUtils';

export default function FuelLogForm({ vehicles, drivers, onSave, onClose }) {
  const [form, setForm] = useState({ vehicle_id: '', driver_id: '', liters: '', price_per_liter: '', total_cost: '', odometer: '', receipt_photo_url: '', logged_at: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === 'liters' || k === 'price_per_liter') {
      const liters = parseFloat(k === 'liters' ? v : f.liters) || 0;
      const price = parseFloat(k === 'price_per_liter' ? v : f.price_per_liter) || 0;
      next.total_cost = (liters * price).toFixed(2);
    }
    return next;
  });

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
    set('receipt_photo_url', file_url);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, liters: parseFloat(form.liters), price_per_liter: parseFloat(form.price_per_liter) || 0, total_cost: parseFloat(form.total_cost) || 0, odometer: parseInt(form.odometer) || 0, logged_at: form.logged_at || new Date().toISOString() });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Registrar combustible</h2>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Vehículo *</Label>
            <Select value={form.vehicle_id} onValueChange={v => set('vehicle_id', v)}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conductor</Label>
            <Select value={form.driver_id} onValueChange={v => set('driver_id', v)}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Litros</Label>
              <Input type="number" step="0.01" value={form.liters} onChange={e => set('liters', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Precio/litro</Label>
              <Input type="number" step="0.01" value={form.price_per_liter} onChange={e => set('price_per_liter', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Total ($)</Label>
              <Input type="number" step="0.01" value={form.total_cost} onChange={e => set('total_cost', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Odómetro</Label>
              <Input type="number" value={form.odometer} onChange={e => set('odometer', e.target.value)} className="mt-1 bg-background" />
            </div>
          </div>
          <div>
            <Label>Foto de recibo</Label>
            <label className="mt-1 flex items-center gap-2 cursor-pointer bg-background border border-input rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <Upload className="w-4 h-4" />{uploading ? 'Subiendo...' : form.receipt_photo_url ? 'Ver recibo ✓' : 'Subir foto'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
            </label>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={saving || uploading || !form.vehicle_id} className="flex-1">{saving ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}