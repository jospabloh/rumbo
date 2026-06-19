import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { isAdminOrOwner } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { FormError } from '@/components/ui/form-error';
import { LinkIcon, ExternalLink, Plus, Trash2, Pencil } from 'lucide-react';
import { useEntityList, useInvalidateEntity } from '@/hooks/useEntities';

const normalizeUrl = (u) => {
  const t = (u || '').trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export default function UsefulLinks() {
  const { tenantId, userRole, readOnly } = useTenant();
  const canManage = isAdminOrOwner(userRole) && !readOnly;
  const { data, isLoading: loading } = useEntityList('UsefulLink', { enabled: !!tenantId });
  const invalidate = useInvalidateEntity();
  const refresh = () => invalidate('UsefulLink');
  const links = useMemo(
    () => (data ?? []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.label || '').localeCompare(b.label || '')),
    [data],
  );
  const [editing, setEditing] = useState(null); // link object or 'new'
  const [form, setForm] = useState({ label: '', url: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openNew = () => { setForm({ label: '', url: '', description: '' }); setEditing('new'); setError(''); };
  const openEdit = (l) => { setForm({ label: l.label || '', url: l.url || '', description: l.description || '' }); setEditing(l); setError(''); };

  const save = async () => {
    if (!form.label.trim() || !form.url.trim()) { setError('Nombre y URL son requeridos.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { label: form.label.trim(), url: normalizeUrl(form.url), description: form.description.trim() };
      if (editing === 'new') {
        await base44.entities.UsefulLink.create({ ...payload, tenant_id: tenantId, active: true, sort_order: links.length });
      } else {
        await base44.entities.UsefulLink.update(editing.id, payload);
      }
      setEditing(null);
      refresh();
    } catch (e) {
      setError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (l) => {
    await base44.entities.UsefulLink.delete(l.id).catch(() => {});
    refresh();
  };

  const visible = links.filter(l => l.active || canManage);

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><LinkIcon className="w-5 h-5 text-primary" />Enlaces útiles</h1>
          <p className="text-sm text-muted-foreground">Accesos a sistemas externos de tu organización.</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Agregar</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : visible.length === 0 ? (
        <p className="text-center text-muted-foreground py-10 text-sm">
          {canManage ? 'Aún no hay enlaces. Agrega el primero con el botón de arriba.' : 'Tu organización aún no ha configurado enlaces.'}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map(l => (
            <div key={l.id} className={`bg-card border border-border rounded-xl p-4 flex items-center gap-3 ${!l.active ? 'opacity-60' : ''}`}>
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><ExternalLink className="w-4 h-4" /></div>
              <a href={normalizeUrl(l.url)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 hover:opacity-80">
                <p className="text-sm font-semibold truncate">{l.label}{!l.active && <span className="text-xs text-muted-foreground ml-2">(inactivo)</span>}</p>
                {l.description && <p className="text-xs text-muted-foreground truncate">{l.description}</p>}
                <p className="text-xs text-primary truncate">{l.url}</p>
              </a>
              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(l)} className="text-muted-foreground hover:text-foreground p-1" title="Editar"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(l)} className="text-muted-foreground hover:text-destructive p-1" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ResponsiveModal title={editing === 'new' ? 'Nuevo enlace' : 'Editar enlace'} onClose={() => setEditing(null)} maxWidth="md">
            <div className="space-y-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="mt-1 bg-background" placeholder="Ej. GPS de unidades" />
              </div>
              <div>
                <Label>URL *</Label>
                <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="mt-1 bg-background" placeholder="gps.eraindefleet.com" />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 bg-background" placeholder="Usuario/empresa, notas..." />
              </div>
              <FormError>{error}</FormError>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">Cancelar</Button>
                <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            </div>
        </ResponsiveModal>
      )}
    </div>
  );
}
