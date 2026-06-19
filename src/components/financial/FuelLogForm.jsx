import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormError } from '@/components/ui/form-error';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/lib/imageUtils';
import { fuelLogSchema } from '@/lib/schemas';

export default function FuelLogForm({ vehicles, drivers, onSave, onClose }) {
  const [uploading, setUploading] = useState(false);
  const { register, control, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(fuelLogSchema),
    defaultValues: { vehicle_id: '', driver_id: '', liters: '', price_per_liter: '', total_cost: '', odometer: '', receipt_photo_url: '', logged_at: '' },
  });
  const liters = watch('liters');
  const pricePerLiter = watch('price_per_liter');
  const receiptUrl = watch('receipt_photo_url');

  // Total = litros × precio. Recalcula al cambiar cualquiera de los dos; el campo
  // sigue siendo editable a mano (no se toca si no cambian litros/precio).
  useEffect(() => {
    const l = parseFloat(liters) || 0;
    const p = parseFloat(pricePerLiter) || 0;
    setValue('total_cost', l && p ? (l * p).toFixed(2) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liters, pricePerLiter]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
    setValue('receipt_photo_url', file_url);
    setUploading(false);
  };

  const onValid = async (data) => {
    try {
      await onSave({
        ...data,
        liters: data.liters ?? 0,
        price_per_liter: data.price_per_liter ?? 0,
        total_cost: data.total_cost ?? 0,
        odometer: data.odometer ?? 0,
        logged_at: data.logged_at || new Date().toISOString(),
      });
    } catch (err) {
      setError('root', { message: err?.message || 'No se pudo registrar el combustible. Inténtalo de nuevo.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Registrar combustible</h2>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Litros</Label>
              <Input type="number" step="0.01" {...register('liters')} className="mt-1 bg-background" />
              <FormError className="mt-1">{errors.liters?.message}</FormError>
            </div>
            <div>
              <Label>Precio/litro</Label>
              <Input type="number" step="0.01" {...register('price_per_liter')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Total ($)</Label>
              <Input type="number" step="0.01" {...register('total_cost')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Odómetro</Label>
              <Input type="number" {...register('odometer')} className="mt-1 bg-background" />
            </div>
          </div>
          <div>
            <Label>Foto de recibo</Label>
            <label className="mt-1 flex items-center gap-2 cursor-pointer bg-background border border-input rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <Upload className="w-4 h-4" />{uploading ? 'Subiendo...' : receiptUrl ? 'Ver recibo ✓' : 'Subir foto'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
            </label>
          </div>
          <FormError className="bg-destructive/10 rounded-lg px-3 py-2">{errors.root?.message}</FormError>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || uploading} className="flex-1">{isSubmitting ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
