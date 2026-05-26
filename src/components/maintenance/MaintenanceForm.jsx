import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/lib/imageUtils';

export default function MaintenanceForm({ record, vehicles, onSave, onClose }) {
  const [form, setForm] = useState({
    vehicle_id: record?.vehicle_id || '',
    kind: record?.kind || 'preventive',
    description: record?.description || '',
    odometer: record?.odometer || '',
    cost: record?.cost || '',
    performed_at: record?.performed_at || '',
    next_due_at: record?.next_due_at || '',
    photo_url: record?.photo_url || '',
  });
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
    await onSave({
      ...form,
      odometer: form.odometer ? parseInt(form.odometer) : null,
      cost: form.cost ? parseFloat(form.cost) : null,
      next_due_at: form.next_due_at || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">Registrar mantenimiento</h2>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Vehículo *</Label>
              <Select value={form.vehicle_id} onValueChange={v => set('vehicle_id', v)}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={v => set('kind', v)}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventive">Preventivo</SelectItem>
                  <SelectItem value="corrective">Correctivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} className="mt-1 bg-background" rows={2} />
            </div>
            <div>
              <Label>Odómetro (km)</Label>
              <Input type="number" value={form.odometer} onChange={e => set('odometer', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Costo ($)</Label>
              <Input type="number" step="0.01" value={form.cost} onChange={e => set('cost', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Fecha realizado</Label>
              <Input type="date" value={form.performed_at} onChange={e => set('performed_at', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Próxima revisión</Label>
              <Input type="date" value={form.next_due_at} onChange={e => set('next_due_at', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div className="col-span-2">
              <Label>Foto</Label>
              <label className="mt-1 flex items-center gap-2 cursor-pointer bg-background border border-input rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                <Upload className="w-4 h-4" />{uploading ? 'Subiendo...' : form.photo_url ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={saving || uploading || !form.vehicle_id} className="flex-1">
              {saving ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}