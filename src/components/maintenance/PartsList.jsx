import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/lib/TenantContext';
import { useModulePerms } from '@/lib/modulePerms';

export default function PartsList({ vehicles }) {
  const { tenantId, readOnly } = useTenant();
  const { can } = useModulePerms();
  const [parts, setParts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', brand: '', sku: '', unit_number: '', stock: /** @type {string|number} */ (0), unit_cost: '', vehicle_id: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    const q = tenantId ? { tenant_id: tenantId } : {};
    base44.entities.Part.filter(q).then(setParts);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Part.create({
      ...form,
      tenant_id: tenantId,
      stock: parseInt(String(form.stock)),
      unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null,
      vehicle_id: form.vehicle_id || null,
    });
    setForm({ name: '', brand: '', sku: '', unit_number: '', stock: 0, unit_cost: '', vehicle_id: '' });
    setShowForm(false);
    load();
    setSaving(false);
  };

  const adjustStock = async (part, delta) => {
    const newStock = (part.stock || 0) + delta;
    if (newStock < 0) return; // enforce >= 0
    await base44.entities.Part.update(part.id, { stock: newStock });
    setParts(p => p.map(x => x.id === part.id ? { ...x, stock: newStock } : x));
  };

  const handleDelete = async (id) => {
    await base44.entities.Part.delete(id);
    setParts(p => p.filter(x => x.id !== id));
  };

  return (
    <div>
      {!readOnly && can('parts', 'create') && (
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" />Agregar repuesto</Button>
        </div>
      )}

      <div className="space-y-2">
        {parts.map(p => {
          const v = vehicles?.find(x => x.id === p.vehicle_id);
          return (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{p.name}{p.brand && <span className="text-muted-foreground font-normal"> · {p.brand}</span>}</p>
                <p className="text-xs text-muted-foreground">{p.sku && `SKU: ${p.sku} · `}{p.unit_number && `Unidad ${p.unit_number} · `}{v ? v.plate : 'General'}</p>
                {p.unit_cost && <p className="text-xs text-muted-foreground">${parseFloat(p.unit_cost).toFixed(2)} c/u</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => adjustStock(p, -1)} className="w-7 h-7 rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center font-bold transition-colors">−</button>
                <span className={`text-sm font-bold w-8 text-center ${p.stock === 0 ? 'text-destructive' : p.stock <= 2 ? 'text-warning' : 'text-foreground'}`}>{p.stock}</span>
                <button onClick={() => adjustStock(p, 1)} className="w-7 h-7 rounded-lg bg-muted text-muted-foreground hover:bg-success/10 hover:text-success flex items-center justify-center font-bold transition-colors">+</button>
                <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-1"><X className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {parts.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Sin repuestos en inventario</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Nuevo repuesto</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
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
                  <Label>Stock inicial</Label>
                  <Input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="mt-1 bg-background" />
                </div>
                <div>
                  <Label>Costo unitario</Label>
                  <Input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} className="mt-1 bg-background" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
                <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Guardando...' : 'Agregar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}