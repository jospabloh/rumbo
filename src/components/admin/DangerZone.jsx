import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle, Trash2, ArrowRightLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DangerZone({ tenant, onDeleted, onDelegated, isOwner }) {
  const [delegateEmail, setDelegateEmail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loadingDelegate, setLoadingDelegate] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [doneDelegate, setDoneDelegate] = useState(false);
  const [delegateError, setDelegateError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [exportError, setExportError] = useState(null);

  const handleExport = async () => {
    setLoadingExport(true);
    setExportError(null);
    try {
      const resp = await base44.functions.invoke('exportTenantData', {});
      if (!resp?.data?.success) {
        setExportError(resp?.data?.error || 'No se pudieron exportar los datos.');
        return;
      }
      const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rumbo-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError('Error al exportar. Intenta de nuevo.');
      console.error('Export tenant data failed:', e);
    } finally {
      setLoadingExport(false);
    }
  };

  const members = Array.isArray(tenant?.members) ? tenant.members : [];
  const normalizedTarget = delegateEmail.trim().toLowerCase();
  // Delegation must land on an existing member of this tenant — free-typing an arbitrary
  // address risks locking every current user out of a tenant they can no longer own/manage.
  const targetIsMember = normalizedTarget && members.some(m => (m.email || '').toLowerCase() === normalizedTarget);

  const handleDelegate = async () => {
    if (!targetIsMember || !tenant?.id) return;
    setLoadingDelegate(true);
    setDelegateError(null);
    try {
      // Only the tenant's owner (module 14: not admin — see delegateOwnership/entry.ts)
      // can reassign owner_email. It's rls.write:false on the entity now, so this must
      // go through the service-role function rather than a direct entity update.
      const resp = await base44.functions.invoke('delegateOwnership', { targetEmail: normalizedTarget });
      if (!resp?.data?.success) {
        setDelegateError(resp?.data?.error || 'Error al delegar. Intenta de nuevo.');
        return;
      }
      setDoneDelegate(true);
      setTimeout(() => { setDoneDelegate(false); setDelegateEmail(''); onDelegated(); }, 2000);
    } catch (e) {
      setDelegateError('Error al delegar. Intenta de nuevo.');
      console.error('Delegate ownership failed:', e);
    } finally {
      setLoadingDelegate(false);
    }
  };

  const handleDelete = async () => {
    if (confirmDelete !== 'ELIMINAR' || !tenant?.id) return;
    setLoadingDelete(true);
    setDeleteError(null);
    try {
      await base44.entities.TenantLicense.delete(tenant.id);
      onDeleted();
    } catch (e) {
      setDeleteError('Error al eliminar. Intenta de nuevo.');
      console.error('Delete tenant failed:', e);
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <section className="border border-destructive/40 rounded-xl p-5 space-y-5 bg-destructive/5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide">Zona de Peligro</h2>
      </div>

      {/* Exportar datos */}
      <div className="space-y-2 pb-1">
        <div className="flex items-start gap-3">
          <Download className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Descargar mis datos</p>
            <p className="text-xs text-muted-foreground">Exporta vehículos, conductores, viajes y demás datos operativos de tu tenant en formato JSON. Hazlo antes de eliminar.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-9 gap-2" disabled={loadingExport} onClick={handleExport}>
          <Download className="w-4 h-4" />
          {loadingExport ? 'Exportando...' : 'Descargar datos'}
        </Button>
        {exportError && <p className="text-xs text-destructive">{exportError}</p>}
      </div>

      {/* Delegar ownership y eliminar tenant — solo el owner (módulo 14: un admin no debe
          poder auto-delegarse la propiedad y luego borrar el tenant con ella). El export
          de arriba se queda disponible para admin también — no es una acción de riesgo. */}
      {isOwner ? (
        <>
          {/* Delegar ownership */}
          <div className="space-y-2 border-t border-destructive/20 pt-4">
            <div className="flex items-start gap-3">
              <ArrowRightLeft className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Delegar ownership</p>
                <p className="text-xs text-muted-foreground">Transfiere el control del tenant a otro miembro. Debe ser el email de un usuario que ya pertenece a este tenant.</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="nuevo@owner.com"
                value={delegateEmail}
                onChange={e => setDelegateEmail(e.target.value)}
                className="bg-secondary border-border text-sm h-9 flex-1 min-w-[180px]"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-2 border-warning text-warning hover:bg-warning/10"
                disabled={loadingDelegate || doneDelegate || !targetIsMember}
                onClick={handleDelegate}
              >
                {doneDelegate ? <CheckCircle2 className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
                {doneDelegate ? 'Delegado' : 'Delegar'}
              </Button>
            </div>
            {delegateEmail.trim() && !targetIsMember && (
              <p className="text-xs text-destructive">Ese email no pertenece a ningún miembro de este tenant.</p>
            )}
            {delegateError && <p className="text-xs text-destructive">{delegateError}</p>}
          </div>

          {/* Eliminar tenant */}
          {tenant?.id && (
            <div className="space-y-2 border-t border-destructive/20 pt-4">
              <div className="flex items-start gap-3">
                <Trash2 className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Eliminar tenant</p>
                  <p className="text-xs text-muted-foreground">Esta acción es irreversible. Escribe <span className="font-mono font-bold text-destructive">ELIMINAR</span> para confirmar.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="ELIMINAR"
                  value={confirmDelete}
                  onChange={e => setConfirmDelete(e.target.value)}
                  className="bg-secondary border-border text-sm h-9 flex-1 min-w-[140px] font-mono"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-9 gap-2"
                  disabled={loadingDelete || confirmDelete !== 'ELIMINAR'}
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4" />
                  {loadingDelete ? 'Eliminando...' : 'Eliminar'}
                </Button>
              </div>
              {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
            </div>
          )}
        </>
      ) : (
        <div className="border-t border-destructive/20 pt-4">
          <p className="text-xs text-muted-foreground">Delegar la propiedad o eliminar el tenant son acciones solo del owner actual.</p>
        </div>
      )}
    </section>
  );
}
