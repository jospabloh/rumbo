import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormError } from '@/components/ui/form-error';
import { useCatalog } from '@/lib/catalogs';
import { vehicleSchema } from '@/lib/schemas';

export default function VehicleForm({ vehicle, drivers, onSave, onClose }) {
  const makes = useCatalog('vehicle_make');
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plate: vehicle?.plate || '',
      unit_number: vehicle?.unit_number || '',
      make: vehicle?.make || '',
      model: vehicle?.model || '',
      year: vehicle?.year ?? '',
      vin: vehicle?.vin || '',
      status: vehicle?.status || 'active',
      assigned_driver_id: vehicle?.assigned_driver_id || '',
      insurance_policy_no: vehicle?.insurance_policy_no || '',
      insurance_expiry: vehicle?.insurance_expiry || '',
      inspection_expiry: vehicle?.inspection_expiry || '',
      registration_expiry: vehicle?.registration_expiry || '',
      hologram_expiry: vehicle?.hologram_expiry || '',
      odometer: vehicle?.odometer ?? 0,
      rent_amount: vehicle?.rent_amount ?? '',
      rent_frequency: vehicle?.rent_frequency || 'weekly',
      rent_day: vehicle?.rent_day || 'monday',
    },
  });
  const rentFrequency = useWatch({ control, name: 'rent_frequency' });

  const onValid = async (data) => {
    try {
      await onSave({
        ...data,
        year: data.year ?? null,
        odometer: data.odometer ?? 0,
        rent_amount: data.rent_amount ?? null,
        assigned_driver_id: data.assigned_driver_id || null,
      });
    } catch (err) {
      setError('root', { message: err?.message || 'No se pudo guardar el vehículo. Revisa tu conexión e inténtalo de nuevo.' });
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
        <form onSubmit={handleSubmit(onValid)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>No. de unidad</Label>
              <Input {...register('unit_number')} className="mt-1 bg-background" placeholder="Ej. U01" />
            </div>
            <div>
              <Label>Placa</Label>
              <Input {...register('plate', { onChange: (e) => { e.target.value = e.target.value.toUpperCase(); } })} className="mt-1 bg-background" />
              <FormError className="mt-1">{errors.plate?.message}</FormError>
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
                      <SelectItem value="maintenance">Mantenimiento</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>Marca</Label>
              <Input {...register('make')} className="mt-1 bg-background" list="vehicle-makes" />
              <datalist id="vehicle-makes">
                {makes.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div>
              <Label>Modelo</Label>
              <Input {...register('model')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Año</Label>
              <Input type="number" {...register('year')} className="mt-1 bg-background" />
              <FormError className="mt-1">{errors.year?.message}</FormError>
            </div>
            <div>
              <Label>VIN</Label>
              <Input {...register('vin')} className="mt-1 bg-background" />
            </div>
            <div className="col-span-2">
              <Label>Conductor asignado</Label>
              <Controller
                name="assigned_driver_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || 'none'} onValueChange={v => field.onChange(v === 'none' ? '' : v)}>
                    <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>No. de póliza</Label>
              <Input {...register('insurance_policy_no')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Odómetro (km)</Label>
              <Input type="number" {...register('odometer')} className="mt-1 bg-background" />
              <FormError className="mt-1">{errors.odometer?.message}</FormError>
            </div>
            <div>
              <Label>Venc. seguro</Label>
              <Input type="date" {...register('insurance_expiry')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Venc. inspección</Label>
              <Input type="date" {...register('inspection_expiry')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Venc. registro</Label>
              <Input type="date" {...register('registration_expiry')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Venc. holograma</Label>
              <Input type="date" {...register('hologram_expiry')} className="mt-1 bg-background" />
            </div>
            <div>
              <Label>Tarifa de renta ($)</Label>
              <Input type="number" step="0.01" {...register('rent_amount')} className="mt-1 bg-background" placeholder="Ej. 2800" />
              <FormError className="mt-1">{errors.rent_amount?.message}</FormError>
            </div>
            <div>
              <Label>Frecuencia de renta</Label>
              <Controller
                name="rent_frequency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="daily">Diaria</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {rentFrequency === 'weekly' && (
              <div>
                <Label>Día de cobro</Label>
                <Controller
                  name="rent_day"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monday">Lunes</SelectItem>
                        <SelectItem value="tuesday">Martes</SelectItem>
                        <SelectItem value="wednesday">Miércoles</SelectItem>
                        <SelectItem value="thursday">Jueves</SelectItem>
                        <SelectItem value="friday">Viernes</SelectItem>
                        <SelectItem value="saturday">Sábado</SelectItem>
                        <SelectItem value="sunday">Domingo</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>
          <FormError className="bg-destructive/10 rounded-lg px-3 py-2">{errors.root?.message}</FormError>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Guardando...' : vehicle ? 'Guardar' : 'Crear vehículo'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
