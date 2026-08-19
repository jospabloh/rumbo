import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, DollarSign, Receipt, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTenant } from '@/lib/TenantContext';
import { useInvalidateEntity } from '@/hooks/useEntities';
import ExpenseForm from '@/components/financial/ExpenseForm';
import MaintenanceForm from '@/components/maintenance/MaintenanceForm';
import QuickIncomeModal from '@/components/reports/QuickIncomeModal';
import { guardedCreate } from '@/lib/guardedWrite';

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Botón "Registrar" (Ingreso/Gasto/Mantenimiento) reutilizable, ya prefijado a
 * una unidad — y opcionalmente a un día concreto (celda de la matriz) o al día
 * de hoy por default (tarjeta de unidad). Usado tanto en UnitDayCellDetail
 * como en UnitCardGrid para que registrar algo no dependa de haber abierto
 * antes una celda específica.
 *
 * `onCloseAutoFocus` se previene en el Popover: Radix regresa el foco al
 * trigger al cerrar, y si el trigger quedó en una tarjeta lejos del viewport
 * (p. ej. tras un reflow), eso puede saltar el scroll — lo evitamos aquí.
 *
 * @param {{ vehicleId: string, plate?: string, unitNumber?: string|number, driverId?: string|null, date?: string, onSaved?: () => void }} props
 */
export default function RegistrarMenu({ vehicleId, plate, unitNumber, driverId, date, onSaved }) {
  const { tenantId } = useTenant();
  const invalidate = useInvalidateEntity();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openForm, setOpenForm] = useState(null); // null | 'income' | 'expense' | 'maintenance'

  const effectiveDate = date || todayStr();
  const singleVehicleList = [{ id: vehicleId, plate: plate || `#${unitNumber}` }];

  const afterSave = (entityName) => {
    invalidate(entityName);
    qc.invalidateQueries({ queryKey: ['fleetUnitMetrics'] });
    setOpenForm(null);
    onSaved?.();
  };

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="w-3.5 h-3.5" />Registrar
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-52 p-1"
          align="end"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { setOpenForm('income'); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-accent text-left">
            <DollarSign className="w-4 h-4 text-success" />Ingreso
          </button>
          <button onClick={() => { setOpenForm('expense'); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-accent text-left">
            <Receipt className="w-4 h-4 text-destructive" />Gasto
          </button>
          <button onClick={() => { setOpenForm('maintenance'); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-accent text-left">
            <Wrench className="w-4 h-4 text-warning" />Mantenimiento
          </button>
        </PopoverContent>
      </Popover>

      {openForm === 'expense' && (
        <ExpenseForm
          record={{ vehicle_id: vehicleId, expense_date: effectiveDate }}
          vehicles={singleVehicleList}
          onClose={() => setOpenForm(null)}
          onSave={async (data) => {
            await guardedCreate('Expense', data);
            afterSave('Expense');
          }}
        />
      )}
      {openForm === 'maintenance' && (
        <MaintenanceForm
          record={{ vehicle_id: vehicleId, performed_at: effectiveDate }}
          vehicles={singleVehicleList}
          onClose={() => setOpenForm(null)}
          onSave={async (data) => {
            await guardedCreate('Maintenance', data);
            afterSave('Maintenance');
          }}
        />
      )}
      {openForm === 'income' && (
        <QuickIncomeModal
          tenantId={tenantId}
          vehicleId={vehicleId}
          driverId={driverId}
          date={effectiveDate}
          onClose={() => setOpenForm(null)}
          onSaved={() => afterSave('RentCharge')}
        />
      )}
    </>
  );
}
