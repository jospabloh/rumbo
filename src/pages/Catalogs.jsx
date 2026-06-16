import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { CATALOG_CATEGORIES, defaultsFor } from '@/lib/catalogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { List, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

export default function Catalogs() {
  const { tenantId, readOnly } = useTenant();
  const [category, setCategory] = useState(CATALOG_CATEGORIES[0].key);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!tenantId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    base44.entities.Catalog.filter({ tenant_id: tenantId, category })
      .then(rows => setItems(rows.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [tenantId, category]);

  const add = async () => {
    const label = newLabel.trim();
    if (!label || !tenantId) return;
    setSaving(true);
    await base44.entities.Catalog.create({
      tenant_id: tenantId,
      category,
      label,
      active: true,
      sort_order: items.length,
    }).catch(() => {});
    setNewLabel('');
    setSaving(false);
    load();
  };

  const toggle = async (item) => {
    await base44.entities.Catalog.update(item.id, { active: !item.active }).catch(() => {});
    load();
  };

  const remove = async (item) => {
    await base44.entities.Catalog.delete(item.id).catch(() => {});
    load();
  };

  const cat = CATALOG_CATEGORIES.find(c => c.key === category);
  const usingDefaults = !loading && items.length === 0;

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold flex items-center gap-2"><List className="w-5 h-5 text-primary" />Catálogos</h1>
        <p className="text-sm text-muted-foreground">Define los valores que usa la app en sus listas desplegables.</p>
      </div>

      <div className="mb-4">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATALOG_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Alta */}
      {!readOnly && (
        <div className="flex gap-2 mb-4">
          <Input
            placeholder={`Nuevo valor para "${cat?.label}"...`}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            className="bg-card border-border"
          />
          <Button onClick={add} disabled={saving || !newLabel.trim()} className="gap-2"><Plus className="w-4 h-4" />Agregar</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : usingDefaults ? (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-2">Este tenant aún no tiene valores propios. La app usa estos predeterminados:</p>
          <div className="flex flex-wrap gap-2">
            {defaultsFor(category).map(d => (
              <span key={d} className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-full">{d}</span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Agrega un valor arriba para empezar a personalizarlos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={`bg-card border border-border rounded-xl p-3 flex items-center gap-3 ${!item.active ? 'opacity-60' : ''}`}>
              <span className="flex-1 text-sm">{item.label}{!item.active && <span className="text-xs text-muted-foreground ml-2">(inactivo)</span>}</span>
              {!readOnly && (
                <>
                  <button onClick={() => toggle(item)} className="text-muted-foreground hover:text-foreground" title={item.active ? 'Desactivar' : 'Activar'}>
                    {item.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => remove(item)} className="text-muted-foreground hover:text-destructive" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
