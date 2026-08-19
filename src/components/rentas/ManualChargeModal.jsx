import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { FormError } from '@/components/ui/form-error';
import { currentPeriod } from '@/components/rentas/rentUtils';
import { guardedCreate } from '@/lib/guardedWrite';

export default function ManualChargeModal({ vehicles, tenantId, onClose, onSaved }) {
  const { period_start, period_end } = currentPeriod('weekly');
  const [form, setForm] = useState({ vehicle_id: '', period_type: 'weekly', period_start, period_end, amount_due: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onVehicle = (id) => {
    const v = vehicles.find(x => x.id === id);
    const freq = v?.rent_frequency || 'weekly';
    const per = currentPeriod(freq, v?.rent_day);
    setForm(f => ({
      ...f,
      vehicle_id: id,
      period_type: freq,
      period_start: per.period_start,
      period_end: per.period_end,
      amount_due: v?.rent_amount ? String(v.rent_amount) : f.amount_due,
    }));
  };

  const save = async () => {
    const v = vehicles.find(x => x.id === form.vehicle_id);
    if (!v) { setError('Selecciona una unidad.'); return; }
    const amount = parseFloat(form.amount_due);
    if (!amount || amount <= 0) { setError('Ingresa el monto de la renta.'); return; }
    if (!tenantId) { setError('Tu organización aún se está configurando.'); return; }
    setSaving(true);
    setError('');
    try {
      await guardedCreate('RentCharge', {
        vehicle_id: v.id,
        owner_group_id: v.owner_group_id || null,
        driver_id: v.assigned_driver_id || null,
        period_type: form.period_type,
        period_start: form.period_start,
        period_end: form.period_end,
        amount_due: amount,
        amount_paid: 0,
        status: 'pending',
        payments: [],
      });
      onSaved();
    } catch (e) {
      setError('No se pudo crear el cobro. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal title="Cobro manual" onClose={onClose} maxWidth="sm">
        <div className="space-y-3">
          <div>
            <Label>Unidad</Label>
            <Select value={form.vehicle_id} onValueChange={onVehicle}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Selecciona unidad" /></SelectTrigger>
              <SelectContent>
                {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate}{v.unit_number ? ` · #${v.unit_number}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inicio</Label>
              <Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Fin</Label>
              <Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} className="mt-1 bg-background" />
            </div>
          </div>
          <div>
            <Label>Monto de la renta ($)</Label>
            <Input type="number" step="0.01" value={form.amount_due} onChange={e => setForm(f => ({ ...f, amount_due: e.target.value }))} className="mt-1 bg-background" />
          </div>
          <FormError>{error}</FormError>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Guardando...' : 'Crear cobro'}</Button>
          </div>
        </div>
    </ResponsiveModal>
  );
}
