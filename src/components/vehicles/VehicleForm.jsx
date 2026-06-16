import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function VehicleForm({ vehicle, drivers, onSave, onClose }) {
  const [form, setForm] = useState({
    plate: vehicle?.plate || '',
    unit_number: vehicle?.unit_number || '',
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    year: vehicle?.year || '',
    vin: vehicle?.vin || '',
    status: vehicle?.status || 'active',
    assigned_driver_id: vehicle?.assigned_driver_id || '',
    insurance_policy_no: vehicle?.insurance_policy_no || '',
    insurance_expiry: vehicle?.insurance_expiry || '',
    inspection_expiry: vehicle?.inspection_expiry || '',
    registration_expiry: vehicle?.registration_expiry || '',
    hologram_expiry: vehicle?.hologram_expiry || '',
    odometer: vehicle?.odometer || 0,
    rent_amount: vehicle?.rent_amount || '',
    rent_frequency: vehicle?.rent_frequency || 'weekly',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        year: form.year ? parseInt(form.year) : null,
        odometer: form.odometer ? parseInt(form.odometer) : 0,
        rent_amount: form.rent_amount ? parseFloat(form.rent_amount) : null,
        assigned_driver_id: form.assigned_driver_id || null,
      });
      // onSave cierra el formulario al tener éxito; no reseteamos saving aquí.
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el vehículo. Revisa tu conexión e inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{vehicle ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Placa *</Label>
              <Input value={form.plate} onChange={e => set('plate', e.target.value.toUpperCase())} required className="mt-1 bg-background" />
            </div>
            <div>
              <Label>No. de unidad</Label>
              <Input value={form.unit_number} onChange={e => set('unit_number', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="maintenance">Mantenimiento</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Marca</Label>
              <Input value={form.make} onChange={e => set('make', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Modelo</Label>
              <Input value={form.model} onChange={e => set('model', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Año</Label>
              <Input type="number" value={form.year} onChange={e => set('year', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>VIN</Label>
              <Input value={form.vin} onChange={e => set('vin', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div className="col-span-2">
              <Label>Conductor asignado</Label>
              <Select value={form.assigned_driver_id || 'none'} onValueChange={v => set('assigned_driver_id', v === 'none' ? '' : v)}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>No. de póliza</Label>
              <Input value={form.insurance_policy_no} onChange={e => set('insurance_policy_no', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Odómetro (km)</Label>
              <Input type="number" value={form.odometer} onChange={e => set('odometer', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Venc. seguro</Label>
              <Input type="date" value={form.insurance_expiry} onChange={e => set('insurance_expiry', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Venc. inspección</Label>
              <Input type="date" value={form.inspection_expiry} onChange={e => set('inspection_expiry', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Venc. registro</Label>
              <Input type="date" value={form.registration_expiry} onChange={e => set('registration_expiry', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Venc. holograma</Label>
              <Input type="date" value={form.hologram_expiry} onChange={e => set('hologram_expiry', e.target.value)} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Tarifa de renta ($)</Label>
              <Input type="number" step="0.01" value={form.rent_amount} onChange={e => set('rent_amount', e.target.value)} className="mt-1 bg-background" placeholder="Ej. 2800" />
            </div>
            <div>
              <Label>Frecuencia de renta</Label>
              <Select value={form.rent_frequency} onValueChange={v => set('rent_frequency', v)}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="daily">Diaria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Guardando...' : vehicle ? 'Guardar' : 'Crear vehículo'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}