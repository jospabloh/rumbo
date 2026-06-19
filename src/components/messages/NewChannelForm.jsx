import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormError } from '@/components/ui/form-error';
import { base44 } from '@/api/base44Client';
import { channelSchema } from '@/lib/schemas';

export default function NewChannelForm({ onSave, onClose }) {
  const [drivers, setDrivers] = useState([]);
  const { register, control, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(channelSchema),
    defaultValues: { name: '', kind: 'direct', driver_id: '' },
  });
  const kind = watch('kind');

  useEffect(() => {
    base44.entities.Driver.list().then(setDrivers);
  }, []);

  const onValid = async (data) => {
    try {
      await onSave({
        name: data.name || (data.kind === 'broadcast' ? 'General' : 'Directo'),
        kind: data.kind,
        driver_id: data.driver_id || null,
      });
    } catch (err) {
      setError('root', { message: err?.message || 'No se pudo crear el canal. Inténtalo de nuevo.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Nuevo canal</h3>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onValid)} className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Controller
              name="kind"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broadcast">Broadcast (todos los conductores)</SelectItem>
                    <SelectItem value="direct">Directo (1 conductor)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Nombre del canal</Label>
            <Input {...register('name')} placeholder={kind === 'broadcast' ? 'ej. General' : 'ej. Juan Pérez'} className="mt-1 bg-background" />
          </div>
          {kind === 'direct' && (
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
          )}
          <FormError className="bg-destructive/10 rounded-lg px-3 py-2">{errors.root?.message}</FormError>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Creando...' : 'Crear canal'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
