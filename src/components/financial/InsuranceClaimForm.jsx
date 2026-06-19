import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormError } from '@/components/ui/form-error';
import { insuranceClaimSchema } from '@/lib/schemas';

export default function InsuranceClaimForm({ vehicles, drivers, onSave, onClose }) {
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    // Cast sidesteps the RHF/zod-coerce typing mismatch (empty-string numeric
    // input is coerced to a number on submit); field/error types stay intact.
    resolver: /** @type {any} */ (zodResolver(insuranceClaimSchema)),
    defaultValues: { vehicle_id: '', driver_id: '', description: '', claim_amount: '', status: 'open', incident_at: '' },
  });

  const onValid = async (data) => {
    try {
      await onSave({ ...data, claim_amount: data.claim_amount ?? null });
    } catch (err) {
      setError('root', { message: err?.message || 'No se pudo guardar el reclamo. Inténtalo de nuevo.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Reclamo de seguro</h2>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onValid)} className="space-y-3">
          <div>
            <Label>Vehículo *</Label>
            <Controller
              name="vehicle_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}</SelectContent>
                </Select>
              )}
            />
            <FormError className="mt-1">{errors.vehicle_id?.message}</FormError>
          </div>
          <div>
            <Label>Conductor</Label>
            <Controller
              name="driver_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea {...register('description')} className="mt-1 bg-background" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto del reclamo</Label>
              <Input type="number" step="0.01" {...register('claim_amount')} className="mt-1 bg-background" />
              <FormError className="mt-1">{errors.claim_amount?.message}</FormError>
            </div>
            <div>
              <Label>Estado</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Abierto</SelectItem>
                      <SelectItem value="approved">Aprobado</SelectItem>
                      <SelectItem value="denied">Negado</SelectItem>
                      <SelectItem value="closed">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>Fecha del incidente</Label>
              <Input type="date" {...register('incident_at')} className="mt-1 bg-background" />
            </div>
          </div>
          <FormError className="bg-destructive/10 rounded-lg px-3 py-2">{errors.root?.message}</FormError>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
