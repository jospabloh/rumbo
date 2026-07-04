import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormError } from '@/components/ui/form-error';
import { expenseSchema } from '@/lib/schemas';
import { useCatalog } from '@/lib/catalogs';

/**
 * Alta/edición de un gasto general. La categoría y el método de pago se toman de
 * los catálogos configurables del tenant; el vehículo es opcional (para gastos
 * no ligados a una unidad, p. ej. renta de local o papelería).
 */
export default function ExpenseForm({ record, vehicles = [], onSave, onClose }) {
  const categories = useCatalog('expense_category');
  const methods = useCatalog('payment_method');
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: /** @type {any} */ (zodResolver(expenseSchema)),
    defaultValues: {
      category: record?.category || '',
      amount: record?.amount ?? '',
      expense_date: record?.expense_date || '',
      description: record?.description || '',
      vehicle_id: record?.vehicle_id || '',
      payment_method: record?.payment_method || '',
      notes: record?.notes || '',
    },
  });

  const onValid = async (data) => {
    try {
      await onSave({ ...data, amount: data.amount ?? null, vehicle_id: data.vehicle_id || null });
    } catch (err) {
      setError('root', { message: err?.message || 'No se pudo guardar el gasto. Inténtalo de nuevo.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{record ? 'Editar gasto' : 'Registrar gasto'}</h2>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onValid)} className="space-y-3">
          <div>
            <Label>Categoría *</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              )}
            />
            <FormError className="mt-1">{errors.category?.message}</FormError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto ($) *</Label>
              <Input type="number" step="0.01" {...register('amount')} className="mt-1 bg-background" />
              <FormError className="mt-1">{errors.amount?.message}</FormError>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" {...register('expense_date')} className="mt-1 bg-background" />
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Input {...register('description')} className="mt-1 bg-background" placeholder="Ej. Recarga de gasolina, pago de renta…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Método de pago</Label>
              <Controller
                name="payment_method"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>{methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>Vehículo</Label>
              <Controller
                name="vehicle_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea {...register('notes')} className="mt-1 bg-background" rows={2} />
          </div>
          <FormError className="bg-destructive/10 rounded-lg px-3 py-2">{errors.root?.message}</FormError>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Guardando...' : record ? 'Guardar' : 'Registrar'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
