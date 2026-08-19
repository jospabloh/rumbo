import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, TrendingDown, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExpenseForm from '@/components/financial/ExpenseForm';
import { useTenant } from '@/lib/TenantContext';
import { useEntityList, useVehicles, useInvalidateEntity } from '@/hooks/useEntities';
import { guardedCreate, guardedUpdate, guardedDelete } from '@/lib/guardedWrite';

const currentMonthKey = () => format(new Date(), 'yyyy-MM');
const inCurrentMonth = (dateStr) => String(dateStr || '').slice(0, 7) === currentMonthKey();

export default function Expenses() {
  const { tenantId, readOnly } = useTenant();
  const invalidate = useInvalidateEntity();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const expensesQ = useEntityList('Expense', { sort: '-expense_date', enabled: !!tenantId });
  const { data: vehicles = [] } = useVehicles();
  const expenses = expensesQ.data ?? [];
  const loading = expensesQ.isLoading;

  const categories = useMemo(
    () => Array.from(new Set(expenses.map(e => e.category).filter(Boolean))).sort(),
    [expenses],
  );
  const shown = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);

  const totalMonth = expenses.filter(e => inCurrentMonth(e.expense_date)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalAll = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const vehiclePlate = (id) => vehicles.find(v => v.id === id)?.plate;

  const closeForm = () => { setShowForm(false); setEditing(null); };

  const save = async (data) => {
    if (editing) {
      await guardedUpdate('Expense', editing.id, data);
    } else {
      await guardedCreate('Expense', data);
    }
    closeForm();
    invalidate('Expense');
  };

  const remove = async (item) => {
    setError('');
    try {
      await guardedDelete('Expense', item.id);
      invalidate('Expense');
    } catch (err) {
      setError('No se pudo eliminar el gasto. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-5">
        <PageHeader title="Gastos" subtitle="Egresos generales de tu operación" className="mb-0" />
        {!readOnly && (
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" />Registrar</Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-destructive bg-destructive/10"><TrendingDown className="w-4 h-4" /></div>
          <div>
            <p className="text-2xl font-bold font-mono tracking-tight">${totalMonth.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">gastos del mes</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground bg-muted"><Receipt className="w-4 h-4" /></div>
          <div>
            <p className="text-2xl font-bold font-mono tracking-tight">${totalAll.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{expenses.length} registro{expenses.length === 1 ? '' : 's'} en total</p>
          </div>
        </div>
      </div>

      {/* Filtro por categoría */}
      {categories.length > 0 && (
        <div className="mb-4 max-w-xs">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : shown.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin gastos registrados" description="Registra tus egresos generales (renta, sueldos, servicios, peajes…) para verlos aquí y en el Dashboard." className="py-10" />
      ) : (
        <div className="space-y-2">
          {shown.map(e => (
            <div key={e.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-destructive bg-destructive/10"><TrendingDown className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{e.category || 'Gasto'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {e.description || 'Sin descripción'}
                  {e.expense_date ? ` · ${e.expense_date}` : ''}
                  {e.payment_method ? ` · ${e.payment_method}` : ''}
                  {vehiclePlate(e.vehicle_id) ? ` · ${vehiclePlate(e.vehicle_id)}` : ''}
                </p>
              </div>
              <p className="text-sm font-bold shrink-0">${Number(e.amount || 0).toLocaleString()}</p>
              {!readOnly && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditing(e); setShowForm(true); }} className="text-muted-foreground hover:text-foreground p-1" title="Editar"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(e)} className="text-muted-foreground hover:text-destructive p-1" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <ExpenseForm record={editing} vehicles={vehicles} onSave={save} onClose={closeForm} />}
    </div>
  );
}
