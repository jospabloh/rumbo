import { useState } from 'react';
import { Star, Phone, FileText, Calendar, Shield, Truck, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/ui/form-error';
import { PageLoader } from '@/components/ui/spinner';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { useMe, useCurrentDriver, useEntityList, useInvalidateEntity } from '@/hooks/useEntities';
import { guardedUpdate } from '@/lib/guardedWrite';

const docTypeLabel = { license: 'Licencia', medical: 'Cert. médico', background: 'Antecedentes', other: 'Otro' };

export default function DriverProfile() {
  const { isLoading: meLoading } = useMe();
  const { data: driver, isLoading: driverLoading } = useCurrentDriver();
  const enabled = !!driver;
  const { data: docs = [] } = useEntityList('DriverDocument', { filter: { driver_id: driver?.id }, enabled });
  const { data: vehicles = [] } = useEntityList('Vehicle', { filter: { assigned_driver_id: driver?.id }, enabled });
  const invalidate = useInvalidateEntity();
  const loading = meLoading || driverLoading;

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <PageLoader />;

  if (!driver) return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <Shield className="w-10 h-10 text-muted-foreground mb-3" />
      <p className="text-muted-foreground text-sm">Tu expediente no está configurado aún.<br />Contacta al administrador.</p>
    </div>
  );

  const vehicle = vehicles[0] || null;
  const statusCls = driver.status === 'active' ? 'bg-success/10 text-success' : driver.status === 'suspended' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground';
  const statusLabel = driver.status === 'active' ? 'Activo' : driver.status === 'suspended' ? 'Suspendido' : 'Inactivo';

  const openEdit = () => { setPhone(driver.phone || ''); setError(''); setEditing(true); };

  const savePhone = async () => {
    setSaving(true);
    setError('');
    try {
      await guardedUpdate('Driver', driver.id, { phone: phone.trim() });
      invalidate('Driver');
      setEditing(false);
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mi Perfil</h1>
        <Button size="sm" variant="outline" onClick={openEdit} className="gap-2"><Pencil className="w-3.5 h-3.5" />Editar</Button>
      </div>

      {/* Avatar & name */}
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shrink-0 overflow-hidden">
          {driver.photo_url
            ? <img src={driver.photo_url} alt={driver.full_name} className="w-full h-full object-cover" />
            : driver.full_name?.charAt(0)}
        </div>
        <div>
          <h2 className="text-lg font-bold">{driver.full_name}</h2>
          {driver.phone && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" />{driver.phone}
            </p>
          )}
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCls}`}>{statusLabel}</span>
        </div>
        {driver.rating && (
          <div className="ml-auto text-center">
            <p className="text-2xl font-bold text-warning font-mono">{driver.rating}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3 fill-warning text-warning" />Rating</p>
          </div>
        )}
      </div>

      {/* Assigned vehicle */}
      {vehicle && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0"><Truck className="w-5 h-5" /></div>
          <div className="min-w-0">
            <p className="font-bold font-mono tracking-tight">{vehicle.plate || (vehicle.unit_number ? `#${vehicle.unit_number}` : '—')}</p>
            <p className="text-sm text-muted-foreground truncate">{vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}</p>
          </div>
          <span className="ml-auto text-xs px-2 py-0.5 bg-success/10 text-success rounded-full font-medium shrink-0">Asignado</span>
        </div>
      )}

      {/* Info */}
      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 gap-4">
        {[
          { label: 'No. licencia', value: driver.license_no },
          { label: 'Venc. licencia', value: driver.license_expiry },
          { label: 'Contratación', value: driver.hire_date },
        ].map(({ label, value }) => value ? (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium mt-0.5">{value}</p>
          </div>
        ) : null)}
      </div>

      {/* Documents */}
      {docs.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4" />Mis documentos
          </h3>
          {docs.map(doc => (
            <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 hover:opacity-80 transition-opacity">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{docTypeLabel[doc.doc_type] || doc.doc_type}</p>
                {doc.expires_at && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />Vence: {doc.expires_at}
                  </p>
                )}
              </div>
              <span className="text-xs text-primary">Ver →</span>
            </a>
          ))}
        </div>
      )}

      {editing && (
        <ResponsiveModal title="Editar mi perfil" onClose={() => setEditing(false)} maxWidth="sm">
          <div className="space-y-3">
            <div>
              <Label>Teléfono</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 bg-background" placeholder="55 1234 5678" />
            </div>
            <p className="text-xs text-muted-foreground">Para actualizar otros datos (licencia, documentos) contacta a tu administrador.</p>
            <FormError>{error}</FormError>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">Cancelar</Button>
              <Button onClick={savePhone} disabled={saving} className="flex-1">{saving ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </div>
        </ResponsiveModal>
      )}
    </div>
  );
}
