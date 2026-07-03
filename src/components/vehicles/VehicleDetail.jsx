import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Edit, Trash2, Truck, FileText, Upload, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { compressImage } from '@/lib/imageUtils';
import { Link } from 'react-router-dom';

const dayLabel = { monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo' };

export default function VehicleDetail({ vehicle, drivers, onBack, onEdit, onDelete, onRefresh }) {
  const [docs, setDocs] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState('');

  const driver = drivers.find(d => d.id === vehicle.assigned_driver_id);

  useEffect(() => {
    base44.entities.VehicleDocument.filter({ vehicle_id: vehicle.id }).then(setDocs);
    base44.entities.Maintenance.filter({ vehicle_id: vehicle.id }).then(m => setMaintenance(m.slice(0, 5)));
  }, [vehicle.id]);

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDoc(true);
    setDocError('');
    try {
      const compressed = await compressImage(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
      // tenant_id es obligatorio: la RLS de create de VehicleDocument exige que coincida
      // con el tenant del usuario. Sin él el documento se rechazaba y se perdía en silencio.
      await base44.entities.VehicleDocument.create({ tenant_id: vehicle.tenant_id, vehicle_id: vehicle.id, doc_type: 'other', file_url });
      const updated = await base44.entities.VehicleDocument.filter({ vehicle_id: vehicle.id });
      setDocs(updated);
    } catch (err) {
      setDocError('No se pudo subir el documento. Verifica tu conexión y tus permisos, e inténtalo de nuevo.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const fields = [
    ['No. de unidad', vehicle.unit_number],
    ['Marca / Modelo', `${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year ? `(${vehicle.year})` : ''}`],
    ['VIN', vehicle.vin],
    ['Odómetro', vehicle.odometer ? `${vehicle.odometer.toLocaleString()} km` : null],
    ['Póliza de seguro', vehicle.insurance_policy_no],
    ['Venc. seguro', vehicle.insurance_expiry],
    ['Venc. inspección', vehicle.inspection_expiry],
    ['Venc. registro', vehicle.registration_expiry],
    ['Venc. holograma', vehicle.hologram_expiry],
    ['Tarifa de renta', vehicle.rent_amount ? `$${Number(vehicle.rent_amount).toLocaleString()} ${vehicle.rent_frequency === 'daily' ? '/ día' : '/ semana'}` : null],
    ['Día de cobro', vehicle.rent_frequency !== 'daily' && vehicle.rent_amount ? dayLabel[vehicle.rent_day] : null],
  ].filter(([, v]) => v);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">Vehículo</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(vehicle)} className="gap-1"><Edit className="w-3.5 h-3.5" />Editar</Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Truck className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{vehicle.plate || (vehicle.unit_number ? `#${vehicle.unit_number}` : 'Vehículo')}</h2>
          <p className="text-sm text-muted-foreground">{vehicle.make} {vehicle.model} {vehicle.year && `· ${vehicle.year}`}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              vehicle.status === 'active' ? 'bg-success/10 text-success' :
              vehicle.status === 'maintenance' ? 'bg-warning/10 text-warning' :
              'bg-muted text-muted-foreground'
            }`}>{vehicle.status === 'active' ? 'Activo' : vehicle.status === 'maintenance' ? 'Mantenimiento' : 'Inactivo'}</span>
            {driver && <span className="text-xs text-muted-foreground">· {driver.full_name}</span>}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
        {fields.map(([label, val]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium mt-0.5">{val}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-4">
        <Link to={`/location?vehicle=${vehicle.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-2">
            <MapPin className="w-4 h-4" />Pedir ubicación
          </Button>
        </Link>
        <Link to="/maintenance" className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-2">Ver mantenimientos</Button>
        </Link>
      </div>

      {/* Recent maintenance */}
      {maintenance.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">Últimos mantenimientos</h3>
          {maintenance.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{m.description || (m.kind === 'preventive' ? 'Preventivo' : 'Correctivo')}</p>
                <p className="text-xs text-muted-foreground">{m.performed_at} · ${m.cost?.toFixed(2) || '0'}</p>
              </div>
              {m.next_due_at && <p className="text-xs text-muted-foreground">Próx: {m.next_due_at}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Documents */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Documentos</h3>
          <label className="text-xs text-primary cursor-pointer flex items-center gap-1 hover:opacity-80">
            <Upload className="w-3 h-3" />{uploadingDoc ? 'Subiendo...' : 'Subir'}
            <input type="file" accept="image/*" className="hidden" onChange={handleDocUpload} disabled={uploadingDoc} />
          </label>
        </div>
        {docError && <p className="text-xs text-destructive mb-2">{docError}</p>}
        {docs.length === 0 ? <p className="text-sm text-muted-foreground">Sin documentos</p> : (
          docs.map(doc => (
            <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 py-2 border-b border-border last:border-0 hover:opacity-80">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm">{doc.doc_type}</p>
                {doc.expires_at && <p className="text-xs text-muted-foreground">Vence: {doc.expires_at}</p>}
              </div>
            </a>
          ))
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-10 bg-card border border-border rounded-xl p-6 mx-4 max-w-sm w-full">
            <h3 className="font-bold mb-2">¿Eliminar vehículo?</h3>
            <p className="text-sm text-muted-foreground mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={() => onDelete(vehicle.id)} className="flex-1">Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}