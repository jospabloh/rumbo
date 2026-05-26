import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

export default function NewChannelForm({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', kind: 'direct', driver_id: '' });
  const [drivers, setDrivers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Driver.list().then(setDrivers);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: form.name || (form.kind === 'broadcast' ? 'General' : 'Directo'),
      kind: form.kind,
      driver_id: form.driver_id || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Nuevo canal</h3>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v }))}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="broadcast">Broadcast (todos los conductores)</SelectItem>
                <SelectItem value="direct">Directo (1 conductor)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nombre del canal</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={form.kind === 'broadcast' ? 'ej. General' : 'ej. Juan Pérez'} className="mt-1 bg-background" />
          </div>
          {form.kind === 'direct' && (
            <div>
              <Label>Conductor</Label>
              <Select value={form.driver_id} onValueChange={v => setForm(f => ({ ...f, driver_id: v }))}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Creando...' : 'Crear canal'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}