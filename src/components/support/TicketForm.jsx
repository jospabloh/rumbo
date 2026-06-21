import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/ui/form-error';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, validateTicket } from '@/lib/support';
import { useInvalidateEntity } from '@/hooks/useEntities';

/**
 * Formulario de alta de ticket de soporte. Crea el ticket vía la función de
 * servidor `submitTicket` (que además notifica al equipo por correo).
 *
 * @param {{ onClose: () => void, onSubmitted?: () => void }} props
 */
export default function TicketForm({ onClose, onSubmitted }) {
  const invalidate = useInvalidateEntity();
  const [form, setForm] = useState({ subject: '', body: '', category: 'question', priority: 'normal' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const validation = validateTicket(form);
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('submitTicket', form);
      const data = res?.data || res;
      if (data?.error) { setError(data.error); setSaving(false); return; }
      invalidate('SupportTicket');
      onSubmitted?.();
      onClose();
    } catch {
      setError('No se pudo enviar el ticket. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal title="Abrir ticket de soporte" onClose={onClose} maxWidth="md">
      <div className="space-y-3">
        <div>
          <Label>Asunto *</Label>
          <Input
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            className="mt-1 bg-background"
            placeholder="Ej. No puedo registrar un cobro"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoría</Label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {TICKET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Prioridad</Label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {TICKET_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label>Describe tu solicitud *</Label>
          <Textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            className="mt-1 bg-background min-h-28"
            placeholder="Cuéntanos qué pasó, en qué pantalla y qué esperabas que sucediera."
          />
        </div>
        <FormError>{error}</FormError>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="flex-1">{saving ? 'Enviando...' : 'Enviar ticket'}</Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
