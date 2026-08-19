import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Edit, Trash2, Star, Phone, FileText, Lock, Upload, X, LinkIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { compressImage } from '@/lib/imageUtils';
import { guardedCreate, guardedUpdate, guardedDelete } from '@/lib/guardedWrite';

const docTypeLabel = { license: 'Licencia', medical: 'Cert. médico', background: 'Antecedentes', other: 'Otro' };

export default function DriverDetail({ driver, onBack, onEdit, onDelete, onRefresh }) {
  const [docs, setDocs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [user, setUser] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [appUsers, setAppUsers] = useState([]);

  useEffect(() => {
    base44.auth.me().then(setUser);
    base44.entities.DriverDocument.filter({ driver_id: driver.id }).then(setDocs);
    base44.auth.me().then(u => {
      if (u?.role !== 'driver') {
        base44.entities.User.list().then(setAppUsers);
      }
      // Private notes are owner/admin only — RLS enforces this too, but avoid
      // even attempting the fetch for a role that would just get an empty/
      // denied result back.
      if (u?.role === 'owner' || u?.role === 'admin') {
        base44.entities.DriverPrivateNote.filter({ driver_id: driver.id }).then(setNotes);
      }
    });
  }, [driver.id]);

  const isAdmin = user?.role !== 'driver';
  const canManagePrivateNotes = user?.role === 'owner' || user?.role === 'admin';

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    await guardedCreate('DriverPrivateNote', {
      driver_id: driver.id,
      author_id: user.id,
      note: newNote.trim(),
    });
    setNewNote('');
    base44.entities.DriverPrivateNote.filter({ driver_id: driver.id }).then(setNotes);
    setAddingNote(false);
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDoc(true);
    const compressed = await compressImage(file);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
    await guardedCreate('DriverDocument', {
      driver_id: driver.id,
      doc_type: 'other',
      file_url,
    });
    base44.entities.DriverDocument.filter({ driver_id: driver.id }).then(setDocs);
    setUploadingDoc(false);
  };

  const handleLinkAccount = async () => {
    if (!linkEmail.trim()) return;
    setLinkSaving(true);
    const matched = appUsers.find(u => u.email?.toLowerCase() === linkEmail.trim().toLowerCase());
    if (matched) {
      await guardedUpdate('Driver', driver.id, { profile_id: matched.id });
      onRefresh();
    }
    setLinkSaving(false);
    setLinkingAccount(false);
    setLinkEmail('');
  };

  const handleDeleteNote = async (id) => {
    await guardedDelete('DriverPrivateNote', id);
    setNotes(n => n.filter(x => x.id !== id));
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">Expediente</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(driver)} className="gap-1"><Edit className="w-3.5 h-3.5" />Editar</Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        )}
      </div>

      {/* Profile header */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shrink-0">
          {driver.photo_url ? (
            <img src={driver.photo_url} alt={driver.full_name} className="w-16 h-16 rounded-full object-cover" />
          ) : driver.full_name?.charAt(0)}
        </div>
        <div>
          <h2 className="text-lg font-bold">{driver.full_name}</h2>
          <div className="flex items-center gap-3 mt-1">
            {driver.phone && <span className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{driver.phone}</span>}
            {driver.rating && <span className="text-sm text-warning flex items-center gap-1"><Star className="w-3 h-3 fill-warning" />{driver.rating}</span>}
          </div>
          <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
            driver.status === 'active' ? 'bg-success/10 text-success' :
            driver.status === 'suspended' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
          }`}>{driver.status === 'active' ? 'Activo' : driver.status === 'suspended' ? 'Suspendido' : 'Inactivo'}</span>
          {driver.referred_by_driver_id && (
            <span className="mt-1 ml-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">Referido</span>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
        {[
          ['Licencia', driver.license_no],
          ['Venc. licencia', driver.license_expiry],
          ['Antecedentes', driver.background_check_date],
          ['Contratación', driver.hire_date],
        ].map(([label, val]) => val ? (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium mt-0.5">{val}</p>
          </div>
        ) : null)}
      </div>

      {/* Documentos del conductor (licencia, INE, comprobante) */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><FileText className="w-4 h-4" />Documentos del conductor</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Licencia', driver.license_file_url],
            ['INE', driver.ine_file_url],
            ['Comprobante', driver.address_proof_file_url],
          ].map(([label, url]) => (
            <div key={label} className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Ver archivo</a>
              ) : (
                <span className="text-xs text-muted-foreground/60">—</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Documentos adicionales */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Documentos adicionales</h3>
          {isAdmin && (
            <label className="text-xs text-primary cursor-pointer flex items-center gap-1 hover:opacity-80">
              <Upload className="w-3 h-3" />{uploadingDoc ? 'Subiendo...' : 'Subir'}
              <input type="file" accept="image/*" className="hidden" onChange={handleDocUpload} disabled={uploadingDoc} />
            </label>
          )}
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin documentos</p>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => (
              <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 py-2 border-b border-border last:border-0 hover:opacity-80 transition-opacity">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{docTypeLabel[doc.doc_type] || doc.doc_type}</p>
                  {doc.expires_at && <p className="text-xs text-muted-foreground">Vence: {doc.expires_at}</p>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Account linking — admin only */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-primary" />
              Cuenta de acceso a la app
            </h3>
            {!driver.profile_id && !linkingAccount && (
              <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setLinkingAccount(true)}>
                Vincular cuenta
              </Button>
            )}
          </div>
          {driver.profile_id ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="w-4 h-4" />
              <span>Cuenta vinculada</span>
              <button
                className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors"
                onClick={async () => { await guardedUpdate('Driver', driver.id, { profile_id: '' }); onRefresh(); }}
              >
                Desvincular
              </button>
            </div>
          ) : linkingAccount ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                placeholder="Email del usuario registrado..."
                value={linkEmail}
                onChange={e => setLinkEmail(e.target.value)}
                className="bg-secondary text-sm h-8 flex-1"
                list="user-emails"
              />
              <datalist id="user-emails">
                {appUsers.map(u => <option key={u.id} value={u.email} />)}
              </datalist>
              <Button size="sm" onClick={handleLinkAccount} disabled={linkSaving || !linkEmail.trim()} className="h-8">
                {linkSaving ? '...' : 'Vincular'}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setLinkingAccount(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin cuenta vinculada. Invita al conductor desde <strong>Admin</strong> y luego vincúlalo aquí.</p>
          )}
        </div>
      )}

      {/* Private notes — owner/admin only (not dispatcher; RLS enforces this too) */}
      {canManagePrivateNotes && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-warning" />Notas privadas <span className="text-xs text-muted-foreground font-normal">(solo admin)</span>
          </h3>
          <div className="space-y-2 mb-3">
            {notes.map(note => (
              <div key={note.id} className="flex items-start gap-2 p-3 bg-background rounded-lg">
                <p className="text-sm flex-1">{note.note}</p>
                <button onClick={() => handleDeleteNote(note.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Textarea
            placeholder="Agregar nota privada..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            className="bg-background text-sm mb-2"
            rows={2}
          />
          <Button size="sm" onClick={handleAddNote} disabled={addingNote || !newNote.trim()} className="w-full">
            {addingNote ? 'Guardando...' : 'Agregar nota'}
          </Button>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-10 bg-card border border-border rounded-xl p-6 mx-4 max-w-sm w-full">
            <h3 className="font-bold mb-2">¿Eliminar conductor?</h3>
            <p className="text-sm text-muted-foreground mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={() => onDelete(driver.id)} className="flex-1">Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}