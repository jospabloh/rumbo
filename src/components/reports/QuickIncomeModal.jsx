import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { FormError } from '@/components/ui/form-error';
import { useCatalog } from '@/lib/catalogs';

/**
 * Registrar un ingreso puntual para una unidad en un día específico, desde el
 * detalle de celda de la matriz de /reports. El modelo de RentCharge solo
 * admite pagos sobre un cobro ya existente (ver Rentas.jsx), así que esto crea
 * un RentCharge de un solo día ya liquidado (amount_paid = amount_due, status
 * 'paid') en vez de forzar el flujo de "generar cobro → registrar pago".
 *
 * @param {{ tenantId: string, vehicleId: string, driverId: string|null, date: string, onClose: () => void, onSaved: () => void }} props
 */
export default function QuickIncomeModal({ tenantId, vehicleId, driverId, date, onClose, onSaved }) {
  const methods = useCatalog('payment_method');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(methods[0] || 'efectivo');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) { setError('Ingresa un monto válido.'); return; }
    if (!tenantId) { setError('Tu organización aún se está configurando.'); return; }
    setSaving(true);
    setError('');
    try {
      await base44.entities.RentCharge.create({
        tenant_id: tenantId,
        vehicle_id: vehicleId,
        driver_id: driverId || undefined,
        period_type: 'daily',
        period_start: date,
        period_end: date,
        amount_due: value,
        amount_paid: value,
        status: 'paid',
        payments: [{ amount: value, paid_at: date, method, note: note.trim() }],
      });
      onSaved();
    } catch (e) {
      setError('No se pudo registrar el ingreso. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal title={`Registrar ingreso · ${date}`} onClose={onClose} maxWidth="sm">
      <div className="space-y-3">
        <div>
          <Label>Monto recibido ($)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 bg-background" autoFocus />
        </div>
        <div>
          <Label>Método</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>{methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Nota (opcional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 bg-background" placeholder="Ej. viaje extra, bono…" />
        </div>
        <FormError>{error}</FormError>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Guardando...' : 'Registrar'}</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
