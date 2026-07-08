import { useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormError } from '@/components/ui/form-error';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/lib/imageUtils';
import { driverSchema } from '@/lib/schemas';

const DOCS = [
  { field: 'license_file_url', label: 'Licencia' },
  { field: 'ine_file_url', label: 'INE' },
  { field: 'address_proof_file_url', label: 'Comprobante de domicilio' },
];

export default function DriverForm({ driver, drivers = [], onSave, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [uploadingField, setUploadingField] = useState('');
  const [uploadError, setUploadError] = useState('');
  const { register, control, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      full_name: driver?.full_name || '',
      referred_by_driver_id: driver?.referred_by_driver_id || '',
      license_no: driver?.license_no || '',
      license_expiry: driver?.license_expiry || '',
      background_check_date: driver?.background_check_date || '',
      hire_date: driver?.hire_date || '',
      phone: driver?.phone || '',
      rating: driver?.rating ?? '',
      status: driver?.status || 'active',
      photo_url: driver?.photo_url || '',
      license_file_url: driver?.license_file_url || '',
      ine_file_url: driver?.ine_file_url || '',
      address_proof_file_url: driver?.address_proof_file_url || '',
      aval_name: driver?.aval_name || '',
    },
  });
  const photoUrl = useWatch({ control, name: 'photo_url' });
  const docUrls = useWatch({ control, name: ['license_file_url', 'ine_file_url', 'address_proof_file_url'] });

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
    setValue('photo_url', file_url);
    setUploading(false);
  };

  // Documentos (licencia, INE, comprobante): se suben tal cual para preservar PDFs.
  const handleDocFile = async (field, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingField(field);
    setUploadError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setValue(field, file_url);
    } catch (err) {
      setUploadError('No se pudo subir el archivo. Inténtalo de nuevo.');
    } finally {
      setUploadingField('');
    }
  };

  const onValid = async (data) => {
    try {
      await onSave({ ...data, rating: data.rating ?? null });
    } catch (err) {
      setError('root', { message: err?.message || 'No se pudo guardar el conductor. Revisa tu conexión e inténtalo de nuevo.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{driver ? 'Editar conductor' : 'Nuevo conductor'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onValid)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nombre completo *</Label>
              <Input {...register('full_name')} className="mt-1 bg-background" />
              <FormError className="mt-1">{errors.full_name?.message}</FormError>
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input {...register('phone')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>No. de licencia</Label>
              <Input {...register('license_no')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Venc. licencia</Label>
              <Input type="date" {...register('license_expiry')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Fecha de antecedentes</Label>
              <Input type="date" {...register('background_check_date')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Fecha de contratación</Label>
              <Input type="date" {...register('hire_date')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Calificación (0-5)</Label>
              <Input type="number" min="0" max="5" step="0.1" {...register('rating')} className="mt-1 bg-background" />
              <FormError className="mt-1">{errors.rating?.message}</FormError>
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
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="suspended">Suspendido</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="col-span-2">
              <Label>Aval / fiador</Label>
              <Input {...register('aval_name')} className="mt-1 bg-background" placeholder="Nombre del aval" />
            </div>
            <div className="col-span-2">
              <Label>Referido por (conductor)</Label>
              <Controller
                name="referred_by_driver_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || 'none'} onValueChange={v => field.onChange(v === 'none' ? '' : v)}>
                    <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Directo (no referido)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Directo (no referido)</SelectItem>
                      {drivers.filter(d => d.id !== driver?.id).map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>Foto</Label>
              <label className="mt-1 flex items-center gap-2 cursor-pointer bg-background border border-input rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Upload className="w-4 h-4" />
                {uploading ? 'Subiendo...' : photoUrl ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
              </label>
            </div>
          </div>

          {/* Documentos del conductor */}
          <div className="space-y-2 pt-1">
            <Label className="text-sm">Documentos</Label>
            {DOCS.map(({ field, label }, i) => (
              <div key={field} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-44 shrink-0">{label}</span>
                {docUrls[i] && (
                  <a href={docUrls[i]} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline shrink-0">Ver</a>
                )}
                <label className="ml-auto flex items-center gap-2 cursor-pointer bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingField === field ? 'Subiendo...' : docUrls[i] ? 'Cambiar' : 'Subir'}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => handleDocFile(field, e)} disabled={!!uploadingField} />
                </label>
              </div>
            ))}
          </div>

          <FormError className="bg-destructive/10 rounded-lg px-3 py-2">{errors.root?.message || uploadError}</FormError>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || uploading || !!uploadingField} className="flex-1">
              {isSubmitting ? 'Guardando...' : driver ? 'Guardar cambios' : 'Crear conductor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
