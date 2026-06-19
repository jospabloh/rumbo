import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle, Trash2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DangerZone({ tenant, onDeleted, onDelegated }) {
  const [delegateEmail, setDelegateEmail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loadingDelegate, setLoadingDelegate] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [doneDelegate, setDoneDelegate] = useState(false);

  const handleDelegate = async () => {
    if (!delegateEmail.trim() || !tenant?.id) return;
    setLoadingDelegate(true);
    await base44.entities.TenantLicense.update(tenant.id, { owner_email: delegateEmail.trim() });
    setDoneDelegate(true);
    setLoadingDelegate(false);
    setTimeout(() => { setDoneDelegate(false); setDelegateEmail(''); onDelegated(); }, 2000);
  };

  const handleDelete = async () => {
    if (confirmDelete !== 'ELIMINAR' || !tenant?.id) return;
    setLoadingDelete(true);
    await base44.entities.TenantLicense.delete(tenant.id);
    setLoadingDelete(false);
    onDeleted();
  };

  return (
    <section className="border border-destructive/40 rounded-xl p-5 space-y-5 bg-destructive/5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide">Zona de Peligro</h2>
      </div>

      {/* Delegar ownership */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <ArrowRightLeft className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Delegar ownership</p>
            <p className="text-xs text-muted-foreground">Transfiere el control del tenant a otro usuario. Ingresa el email del nuevo owner.</p>
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
            disabled={loadingDelegate || doneDelegate || !delegateEmail.trim()}
            onClick={handleDelegate}
          >
            {doneDelegate ? <CheckCircle2 className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
            {doneDelegate ? 'Delegado' : 'Delegar'}
          </Button>
        </div>
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
        </div>
      )}
    </section>
  );
}
