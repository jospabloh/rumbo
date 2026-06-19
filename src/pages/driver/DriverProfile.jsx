import { Star, Phone, FileText, Calendar, Shield } from 'lucide-react';
import { PageLoader } from '@/components/ui/spinner';
import { useMe, useCurrentDriver, useEntityList } from '@/hooks/useEntities';

const docTypeLabel = { license: 'Licencia', medical: 'Cert. médico', background: 'Antecedentes', other: 'Otro' };

export default function DriverProfile() {
  const { isLoading: meLoading } = useMe();
  const { data: driver, isLoading: driverLoading } = useCurrentDriver();
  const { data: docs = [] } = useEntityList('DriverDocument', { filter: { driver_id: driver?.id }, enabled: !!driver });
  const loading = meLoading || driverLoading;

  if (loading) return <PageLoader />;

  if (!driver) return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <Shield className="w-10 h-10 text-muted-foreground mb-3" />
      <p className="text-muted-foreground text-sm">Tu expediente no está configurado aún.<br />Contacta al administrador.</p>
    </div>
  );

  const statusCls = driver.status === 'active' ? 'bg-success/10 text-success' : driver.status === 'suspended' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground';
  const statusLabel = driver.status === 'active' ? 'Activo' : driver.status === 'suspended' ? 'Suspendido' : 'Inactivo';

  return (
    <div className="p-4 space-y-4 max-w-lg">
      <h1 className="text-xl font-bold">Mi Perfil</h1>

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
            <p className="text-2xl font-bold text-warning">{driver.rating}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3 fill-warning text-warning" />Rating</p>
          </div>
        )}
      </div>

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
    </div>
  );
}