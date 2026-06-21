import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Package, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { useTenant } from '@/lib/TenantContext';
import { useModulePerms } from '@/lib/modulePerms';
import { useEntityList, useInvalidateEntity } from '@/hooks/useEntities';
import { isLowStock, isOutOfStock, lowStockParts } from '@/lib/parts';

const EMPTY = {
  name: '', brand: '', sku: '', unit_number: '',
  stock: /** @type {string|number} */ (0),
  min_stock: /** @type {string|number} */ (0),
  unit_cost: /** @type {string|number} */ (''),
  vehicle_id: '',
};

export default function PartsList({ vehicles }) {
  const { tenantId, readOnly } = useTenant();
  const { can } = useModulePerms();
  const { data: parts = [], isLoading } = useEntityList('Part', { enabled: !!tenantId });
  const invalidate = useInvalidateEntity();
  const refresh = () => invalidate('Part');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canManage = !readOnly && can('parts', 'create');
  const lowStock = lowStockParts(parts);

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (p) => {
    setForm({
      name: p.name || '', brand: p.brand || '', sku: p.sku || '', unit_number: p.unit_number || '',
      stock: p.stock ?? 0, min_stock: p.min_stock ?? 0, unit_cost: p.unit_cost ?? '', vehicle_id: p.vehicle_id || '',
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      tenant_id: tenantId,
      stock: parseInt(String(form.stock)) || 0,
      min_stock: parseInt(String(form.min_stock)) || 0,
      unit_cost: form.unit_cost ? parseFloat(String(form.unit_cost)) : null,
      vehicle_id: form.vehicle_id || null,
    };
    if (editId) await base44.entities.Part.update(editId, payload);
    else await base44.entities.Part.create(payload);
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY);
    refresh();
    setSaving(false);
  };

  const adjustStock = async (part, delta) => {
    const newStock = (part.stock || 0) + delta;
    if (newStock < 0) return;
    await base44.entities.Part.update(part.id, { stock: newStock });
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Part.delete(id);
    refresh();
  };

  if (isLoading) return <ListSkeleton rows={4} />;

  return (
    <div>
      {/* Resumen de stock bajo */}
      {lowStock.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-sm text-warning font-medium">
            {lowStock.length} refacción{lowStock.length === 1 ? '' : 'es'} en o por debajo del stock mínimo
          </p>
        </div>
      )}

      {canManage && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Agregar repuesto</Button>
        </div>
      )}

      <div className="space-y-2">
        {parts.map(p => {
          const v = vehicles?.find(x => x.id === p.vehicle_id);
          const low = isLowStock(p);
          const out = isOutOfStock(p);
          return (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${low ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
                <Package className="w-4 h-4" />
              </div>
              <button onClick={() => canManage && openEdit(p)} className={`flex-1 min-w-0 text-left ${canManage ? 'hover:opacity-80' : 'cursor-default'}`}>
                <p className="text-sm font-semibold flex items-center gap-2">
                  {p.name}{p.brand && <span className="text-muted-foreground font-normal"> · {p.brand}</span>}
                  {low && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${out ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                      {out ? 'Agotado' : 'Stock bajo'}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{p.sku && `SKU: ${p.sku} · `}{p.unit_number && `Unidad ${p.unit_number} · `}{v ? v.plate : 'General'}</p>
                <p className="text-xs text-muted-foreground">
                  {p.unit_cost ? `$${parseFloat(p.unit_cost).toFixed(2)} c/u` : ''}
                  {p.min_stock ? `${p.unit_cost ? ' · ' : ''}mín. ${p.min_stock}` : ''}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => adjustStock(p, -1)} disabled={!canManage} className="w-7 h-7 rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center font-bold transition-colors disabled:opacity-40">−</button>
                <span className={`text-sm font-bold w-8 text-center font-mono ${out ? 'text-destructive' : low ? 'text-warning' : 'text-foreground'}`}>{p.stock}</span>
                <button onClick={() => adjustStock(p, 1)} disabled={!canManage} className="w-7 h-7 rounded-lg bg-muted text-muted-foreground hover:bg-success/10 hover:text-success flex items-center justify-center font-bold transition-colors disabled:opacity-40">+</button>
                {canManage && <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-1"><X className="w-4 h-4" /></button>}
              </div>
            </div>
          );
        })}
        {parts.length === 0 && (
          <EmptyState
            icon={Package}
            title="Sin repuestos en inventario"
            description="Agrega refacciones para controlar existencias y recibir avisos de stock bajo."
            action={canManage && <Button size="sm" onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Agregar repuesto</Button>}
          />
        )}
      </div>

      {showForm && (
        <ResponsiveModal title={editId ? 'Editar repuesto' : 'Nuevo repuesto'} onClose={() => { setShowForm(false); setEditId(null); }} maxWidth="md">
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="mt-1 bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Marca</Label>
                <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className="mt-1 bg-background" />
              </div>
              <div>
                <Label>No. de unidad</Label>
                <Input value={form.unit_number} onChange={e => setForm(f => ({ ...f, unit_number: e.target.value }))} className="mt-1 bg-background" />
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} className="mt-1 bg-background" />
              </div>
              <div>
                <Label>Costo unitario</Label>
                <Input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} className="mt-1 bg-background" />
              </div>
              <div>
                <Label>Stock</Label>
                <Input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="mt-1 bg-background" />
              </div>
              <div>
                <Label>Stock mínimo</Label>
                <Input type="number" min="0" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} className="mt-1 bg-background" placeholder="Avisar al llegar a…" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Guardando...' : editId ? 'Guardar' : 'Agregar'}</Button>
            </div>
          </form>
        </ResponsiveModal>
      )}
    </div>
  );
}
