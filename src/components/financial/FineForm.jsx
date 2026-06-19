import { useState } from 'react';
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
import { useCatalog } from '@/lib/catalogs';
import { fineSchema } from '@/lib/schemas';

export default function FineForm({ vehicles, drivers, onSave, onClose }) {
  const fineTypes = useCatalog('fine_type');
  const [uploading, setUploading] = useState(false);
  const { register, control, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm({
    // Cast sidesteps the RHF/zod-coerce typing mismatch (empty-string numeric
    // inputs are coerced to numbers on submit); field/error types stay intact.
    resolver: /** @type {any} */ (zodResolver(fineSchema)),
    defaultValues: { driver_id: '', vehicle_id: '', fine_type: '', amount: '', points: 0, issued_at: '', paid: false, photo_url: '' },
  });
  const photoUrl = watch('photo_url');

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
    setValue('photo_url', file_url);
    setUploading(false);
  };

  const onValid = async (data) => {
    try {
      await onSave({ ...data, points: data.points ?? 0 });
    } catch (err) {
      setError('root', { message: err?.message || 'No se pudo registrar la multa. Inténtalo de nuevo.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Registrar multa</h2>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onValid)} className="space-y-3">
          <div>
            <Label>Conductor *</Label>
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
            <FormError className="mt-1">{errors.driver_id?.message}</FormError>
          </div>
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
            <Label>Tipo de infracción</Label>
            <Controller
              name="fine_type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{fineTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto ($) *</Label>
              <Input type="number" step="0.01" {...register('amount')} className="mt-1 bg-background" />
              <FormError className="mt-1">{errors.amount?.message}</FormError>
            </div>
            <div>
              <Label>Puntos</Label>
              <Input type="number" {...register('points')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" {...register('issued_at')} className="mt-1 bg-background" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" {...register('paid')} className="w-4 h-4" />
                <span className="text-sm">Ya pagada</span>
              </label>
            </div>
          </div>
          <div>
            <Label>Foto</Label>
            <label className="mt-1 flex items-center gap-2 cursor-pointer bg-background border border-input rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <Upload className="w-4 h-4" />{uploading ? 'Subiendo...' : photoUrl ? 'Foto cargada ✓' : 'Subir foto'}
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
