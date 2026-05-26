import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function InsuranceClaimForm({ vehicles, drivers, onSave, onClose }) {
  const [form, setForm] = useState({ vehicle_id: '', driver_id: '', description: '', claim_amount: '', status: 'open', incident_at: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, claim_amount: form.claim_amount ? parseFloat(form.claim_amount) : null });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Reclamo de seguro</h2>
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
          <div>
            <Label>Descripción</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} className="mt-1 bg-background" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto del reclamo</Label>
              <Input type="number" step="0.01" value={form.claim_amount} onChange={e => set('claim_amount', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="denied">Negado</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha del incidente</Label>
              <Input type="date" value={form.incident_at} onChange={e => set('incident_at', e.target.value)} className="mt-1 bg-background" />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={saving || !form.vehicle_id} className="flex-1">{saving ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}