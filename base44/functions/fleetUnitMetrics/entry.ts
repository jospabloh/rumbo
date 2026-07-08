import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * fleetUnitMetrics — utilidad, ranking y pronóstico por unidad para /reports.
 *
 * Una sola función (no varias) para que la ventana de fechas y la definición de
 * "día activo" se calculen una sola vez y no puedan desincronizarse entre
 * endpoints — el mismo tipo de bug que calculateCostPerKm ya documentó
 * (numerador y denominador de ventanas distintas → cifras absurdas). Aquí el
 * mismo helper de ventana se aplica a ingreso (RentCharge.payments), costo
 * (FuelLog + Maintenance + Fine + Expense) y kilómetros (odómetro de FuelLog).
 *
 * Ingreso = RentCharge.payments (lo que la flota efectivamente cobra).
 * Costo   = FuelLog.total_cost + Maintenance.cost + Fine.amount + Expense.amount
 *           (Expense solo si tiene vehicle_id == esta unidad).
 * Utilidad = ingreso - costo.
 *
 * "Día activo": Vehicle.status es una foto actual, no un historial — no hay forma
 * de saber si una unidad estuvo de baja DURANTE el rango. Aproximación documentada:
 * si el status ACTUAL es maintenance/inactive, active_days=0 para todo el rango
 * (se excluye de la mediana de flota); si es active, active_days = todos los días
 * del rango. Lo mismo aplica al conductor asignado (assigned_driver_id actual, sin
 * historial de reasignación).
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Owner or Admin access required' }, { status: 403 });
    }

    const tenantId = user.data?.tenant_id;
    if (!tenantId) return Response.json({ error: 'No tenant asociado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const range = body?.range || {};
    const start = String(range.start || '');
    const end = String(range.end || '');
    const vehicleIdsFilter: string[] | null = Array.isArray(body?.vehicle_ids) ? body.vehicle_ids : null;
    const trailingPeriods = Number(body?.trailingPeriods) || 0;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      return Response.json({ error: 'range.start/range.end inválidos (yyyy-MM-dd, start<=end)' }, { status: 400 });
    }
    const spanDays = daysBetween(start, end) + 1;
    if (spanDays > 400) {
      return Response.json({ error: 'El rango no puede exceder 400 días' }, { status: 400 });
    }
    if (trailingPeriods > 12) {
      return Response.json({ error: 'trailingPeriods no puede exceder 12' }, { status: 400 });
    }

    // Ajustes del tenant (mismo mecanismo que cost_per_km_window_days / rent_grace_days).
    let maintenanceIntervalKm = 5000;
    let tireLifeKm = 40000;
    try {
      const lic = await base44.asServiceRole.entities.TenantLicense.get(tenantId);
      const mi = Number(lic?.settings?.maintenance_interval_km);
      if (Number.isFinite(mi) && mi > 0) maintenanceIntervalKm = mi;
      const tl = Number(lic?.settings?.tire_life_km);
      if (Number.isFinite(tl) && tl > 0) tireLifeKm = tl;
    } catch (_e) { /* usa defaults */ }

    const [vehicles, drivers, rentCharges, fuelLogs, maintenanceRecords, fines, expenses] = await Promise.all([
      base44.entities.Vehicle.filter({ tenant_id: tenantId }),
      base44.entities.Driver.filter({ tenant_id: tenantId }),
      base44.entities.RentCharge.filter({ tenant_id: tenantId }),
      base44.entities.FuelLog.filter({ tenant_id: tenantId }),
      base44.entities.Maintenance.filter({ tenant_id: tenantId }),
      base44.entities.Fine.filter({ tenant_id: tenantId }),
      base44.entities.Expense.filter({ tenant_id: tenantId }),
    ]);

    const inWindow = (dateStr: unknown, ws: string, we: string): boolean => {
      if (!dateStr) return false;
      const d = String(dateStr).slice(0, 10);
      return d >= ws && d <= we;
    };

    /** Métricas de una unidad en una ventana [ws, we] — reutilizada para el periodo actual y cada periodo trailing. */
    function computeWindow(vehicle: any, ws: string, we: string) {
      const vFuel = fuelLogs.filter((l: any) => l.vehicle_id === vehicle.id && inWindow(l.logged_at, ws, we));
      const vMaint = maintenanceRecords.filter((m: any) => m.vehicle_id === vehicle.id && inWindow(m.performed_at, ws, we));
      const vFines = fines.filter((f: any) => f.vehicle_id === vehicle.id && inWindow(f.issued_at, ws, we));
      const vExpenses = expenses.filter((e: any) => e.vehicle_id === vehicle.id && inWindow(e.expense_date, ws, we));
      const vPayments: { amount: number; paid_at: string }[] = [];
      for (const c of rentCharges) {
        if (c.vehicle_id !== vehicle.id) continue;
        for (const p of (c.payments || [])) {
          if (inWindow(p.paid_at, ws, we)) vPayments.push({ amount: parseFloat(p.amount) || 0, paid_at: String(p.paid_at).slice(0, 10) });
        }
      }

      const revenue = vPayments.reduce((s, p) => s + p.amount, 0);
      const fuelCost = vFuel.reduce((s: number, l: any) => s + (parseFloat(l.total_cost) || 0), 0);
      const maintenanceCost = vMaint.reduce((s: number, m: any) => s + (parseFloat(m.cost) || 0), 0);
      const finesCost = vFines.reduce((s: number, f: any) => s + (parseFloat(f.amount) || 0), 0);
      const expensesCost = vExpenses.reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);
      const cost = fuelCost + maintenanceCost + finesCost + expensesCost;
      const profit = revenue - cost;

      const odometerReadings = vFuel.map((l: any) => l.odometer).filter((o: any) => o != null).sort((a: number, b: number) => a - b);
      const kmTraveled = odometerReadings.length >= 2 ? odometerReadings[odometerReadings.length - 1] - odometerReadings[0] : null;
      const costPerKm = kmTraveled && kmTraveled > 0 ? cost / kmTraveled : null;

      const activeDays = (vehicle.status === 'maintenance' || vehicle.status === 'inactive') ? 0 : daysBetween(ws, we) + 1;
      const profitPerActiveDay = activeDays > 0 ? profit / activeDays : null;

      // Fondo de mantenimiento: reserva semanal configurada por unidad × semanas
      // activas del rango, menos lo realmente gastado en Maintenance en ese mismo
      // rango — mismo activeDays que ya usa profit_per_active_day, para que la
      // noción de "unidad en servicio" no se desincronice entre ambas métricas.
      const weeklyReserve = parseFloat(vehicle.maintenance_reserve_weekly) || 0;
      const maintenanceFundReserved = weeklyReserve * (activeDays / 7);
      const maintenanceFundBalance = maintenanceFundReserved - maintenanceCost;

      return { revenue, cost, maintenanceCost, profit, kmTraveled, costPerKm, activeDays, profitPerActiveDay, maintenanceFundReserved, maintenanceFundBalance, vPayments, vFuel, vMaint, vFines, vExpenses };
    }

    // ---- Periodo actual, para todas las unidades del tenant (la mediana de flota
    // se calcula sobre TODAS las unidades, nunca solo sobre las que pidió el cliente
    // — de lo contrario un usuario podría ocultar sus peores unidades e inflar la
    // mediana percibida). ----
    const currentByVehicle = new Map(vehicles.map((v: any) => [v.id, computeWindow(v, start, end)]));

    const eligibleProfits = vehicles
      .map((v: any) => currentByVehicle.get(v.id))
      .filter((r: any) => r.activeDays > 0)
      .map((r: any) => r.profitPerActiveDay as number);
    const medianProfitPerActiveDay = median(eligibleProfits);
    const BELOW_RANGE_RATIO = 0.7;
    const belowRangeThreshold = medianProfitPerActiveDay != null ? medianProfitPerActiveDay * BELOW_RANGE_RATIO : null;

    // ---- Día por día (ingreso/costo/utilidad) para la matriz día × unidad. ----
    const allDates = enumerateDates(start, end);

    // ---- Pronóstico (opcional): mismo cálculo repetido sobre `trailingPeriods`
    // ventanas consecutivas de igual longitud, terminando en la ventana actual. ----
    const trailingWindows: { ws: string; we: string }[] = [];
    if (trailingPeriods > 0) {
      for (let k = trailingPeriods - 1; k >= 0; k--) {
        const we = addDays(end, -k * spanDays);
        const ws = addDays(we, -(spanDays - 1));
        trailingWindows.push({ ws, we });
      }
    }

    const maintenanceByCategory = new Map<string, number>();
    const maintenanceByKind = new Map<string, number>();

    const vehiclesOut = vehicles.map((v: any) => {
      const cur = currentByVehicle.get(v.id)!;
      for (const m of cur.vMaint) {
        const cat = m.category || 'general';
        maintenanceByCategory.set(cat, (maintenanceByCategory.get(cat) || 0) + (parseFloat(m.cost) || 0));
        maintenanceByKind.set(m.kind, (maintenanceByKind.get(m.kind) || 0) + (parseFloat(m.cost) || 0));
      }

      const daily = allDates.map((date) => {
        const dayRevenue = cur.vPayments.filter((p) => p.paid_at === date).reduce((s, p) => s + p.amount, 0);
        const dayFuel = cur.vFuel.filter((l: any) => String(l.logged_at).slice(0, 10) === date).reduce((s: number, l: any) => s + (parseFloat(l.total_cost) || 0), 0);
        const dayMaint = cur.vMaint.filter((m: any) => String(m.performed_at).slice(0, 10) === date).reduce((s: number, m: any) => s + (parseFloat(m.cost) || 0), 0);
        const dayFines = cur.vFines.filter((f: any) => String(f.issued_at).slice(0, 10) === date).reduce((s: number, f: any) => s + (parseFloat(f.amount) || 0), 0);
        const dayExpenses = cur.vExpenses.filter((e: any) => String(e.expense_date).slice(0, 10) === date).reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);
        const dayCost = dayFuel + dayMaint + dayFines + dayExpenses;
        return { date, revenue: dayRevenue, cost: dayCost, profit: dayRevenue - dayCost };
      });

      const belowRange = cur.activeDays > 0 && belowRangeThreshold != null ? cur.profitPerActiveDay! < belowRangeThreshold : false;

      const out: any = {
        vehicle_id: v.id,
        plate: v.plate,
        unit_number: v.unit_number,
        status: v.status,
        assigned_driver_id: v.assigned_driver_id || null,
        revenue: cur.revenue,
        cost: cur.cost,
        profit: cur.profit,
        km_traveled: cur.kmTraveled,
        cost_per_km: cur.costPerKm,
        active_days: cur.activeDays,
        profit_per_active_day: cur.profitPerActiveDay,
        below_range: belowRange,
        maintenance_cost: cur.maintenanceCost,
        maintenance_reserve_weekly: v.maintenance_reserve_weekly || 0,
        maintenance_fund_reserved: cur.maintenanceFundReserved,
        maintenance_fund_balance: cur.maintenanceFundBalance,
        daily,
      };

      if (trailingPeriods > 0) {
        const trailing = trailingWindows.map((w) => computeWindow(v, w.ws, w.we));
        out.trailing_profit_per_active_day = trailing.map((t) => t.profitPerActiveDay);
        const known = out.trailing_profit_per_active_day.filter((x: number | null) => x != null) as number[];
        const { next } = known.length >= 2 ? linearForecast(known) : { next: known[0] ?? null };
        out.projected_next_profit_per_active_day = next;
        out.projected_below_range = next != null && belowRangeThreshold != null ? next < belowRangeThreshold : null;

        out.next_preventive_estimate = estimateNextPreventive(v, cur.vMaint, maintenanceRecords, fuelLogs, maintenanceIntervalKm);
        out.next_tire_estimate = estimateNextTire(v, maintenanceRecords, fuelLogs, tireLifeKm);
      }

      return out;
    });

    const visibleVehicles = vehicleIdsFilter ? vehiclesOut.filter((v: any) => vehicleIdsFilter.includes(v.vehicle_id)) : vehiclesOut;

    // ---- Agregados de flota (sobre TODAS las unidades, no solo las visibles). ----
    const eligible = vehiclesOut.filter((v: any) => v.active_days > 0);
    const mostProductiveVehicle = argBest(eligible, (v: any) => v.profit_per_active_day, 'max');
    const leastProductiveVehicle = argBest(eligible, (v: any) => v.profit_per_active_day, 'min');

    const driverAgg = new Map<string, { revenue: number; cost: number; activeDays: number }>();
    for (const v of vehiclesOut) {
      if (!v.assigned_driver_id || v.active_days <= 0) continue;
      const agg = driverAgg.get(v.assigned_driver_id) || { revenue: 0, cost: 0, activeDays: 0 };
      agg.revenue += v.revenue; agg.cost += v.cost; agg.activeDays += v.active_days;
      driverAgg.set(v.assigned_driver_id, agg);
    }
    const driverRows = [...driverAgg.entries()].map(([driverId, agg]) => {
      const driver = drivers.find((d: any) => d.id === driverId);
      return {
        driver_id: driverId,
        full_name: driver?.full_name || 'Conductor',
        profit_per_active_day: agg.activeDays > 0 ? (agg.revenue - agg.cost) / agg.activeDays : null,
      };
    });
    const mostProductiveDriver = argBest(driverRows, (d) => d.profit_per_active_day, 'max');
    const leastProductiveDriver = argBest(driverRows, (d) => d.profit_per_active_day, 'min');

    return Response.json({
      range: { start, end },
      fleet: {
        vehicle_count: vehicles.length,
        active_vehicle_count: eligible.length,
        median_profit_per_active_day: medianProfitPerActiveDay,
        below_range_ratio: BELOW_RANGE_RATIO,
        below_range_vehicle_ids: vehiclesOut.filter((v: any) => v.below_range).map((v: any) => v.vehicle_id),
        most_productive_vehicle: mostProductiveVehicle,
        least_productive_vehicle: leastProductiveVehicle,
        most_productive_driver: mostProductiveDriver,
        least_productive_driver: leastProductiveDriver,
        driver_rows: driverRows,
        maintenance_by_category: [...maintenanceByCategory.entries()].map(([category, cost]) => ({ category, cost })),
        maintenance_by_kind: [...maintenanceByKind.entries()].map(([kind, cost]) => ({ kind, cost })),
        total_revenue: vehiclesOut.reduce((s: number, v: any) => s + v.revenue, 0),
        total_cost: vehiclesOut.reduce((s: number, v: any) => s + v.cost, 0),
        total_profit: vehiclesOut.reduce((s: number, v: any) => s + v.profit, 0),
      },
      vehicles: visibleVehicles,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ---------- helpers ----------

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round((db - da) / 86400000);
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function enumerateDates(start: string, end: string): string[] {
  const n = daysBetween(start, end) + 1;
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function argBest<T>(rows: T[], value: (r: T) => number | null, dir: 'max' | 'min'): (T & { profit_per_active_day?: number | null }) | null {
  let best: T | null = null;
  let bestVal: number | null = null;
  for (const r of rows) {
    const v = value(r);
    if (v == null) continue;
    if (bestVal == null || (dir === 'max' ? v > bestVal : v < bestVal)) { best = r; bestVal = v; }
  }
  return best;
}

/** Regresión lineal simple (mínimos cuadrados) sobre una serie ordenada; proyecta el siguiente punto. */
function linearForecast(ys: number[]): { slope: number; next: number } {
  const n = ys.length;
  const xBar = (n - 1) / 2;
  const yBar = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  ys.forEach((y, x) => { num += (x - xBar) * (y - yBar); den += (x - xBar) ** 2; });
  const slope = den ? num / den : 0;
  return { slope, next: yBar + slope * (n - xBar) };
}

/** km/día promedio de una unidad sobre TODO su historial de FuelLog (no solo la ventana pedida). */
function avgDailyKm(vehicleId: string, fuelLogs: any[]): number | null {
  const readings = fuelLogs
    .filter((l) => l.vehicle_id === vehicleId && l.odometer != null && l.logged_at)
    .map((l) => ({ date: String(l.logged_at).slice(0, 10), odometer: l.odometer }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (readings.length < 2) return null;
  const first = readings[0], last = readings[readings.length - 1];
  const days = daysBetween(first.date, last.date);
  const km = last.odometer - first.odometer;
  return days > 0 && km > 0 ? km / days : null;
}

/**
 * Próximo mantenimiento preventivo: prioriza next_due_at capturado a mano por el
 * mecánico (autoritativo); si no existe, estima por kilometraje usando el
 * intervalo configurado por el tenant y el km/día promedio de la unidad.
 */
function estimateNextPreventive(vehicle: any, _windowMaint: any[], allMaint: any[], fuelLogs: any[], intervalKm: number) {
  const vAll = allMaint.filter((m) => m.vehicle_id === vehicle.id).sort((a, b) => String(b.performed_at).localeCompare(String(a.performed_at)));
  const withNextDue = vAll.find((m) => m.next_due_at);
  if (withNextDue) return { date: withNextDue.next_due_at, km_remaining: null, source: 'next_due_at' };

  const lastPreventive = vAll.find((m) => m.kind === 'preventive' && m.odometer != null);
  const kmPerDay = avgDailyKm(vehicle.id, fuelLogs);
  if (!lastPreventive || kmPerDay == null) return { date: null, km_remaining: null, source: 'km_projection' };
  const currentOdometer = vehicle.odometer ?? lastPreventive.odometer;
  const kmRemaining = Math.max(0, (lastPreventive.odometer + intervalKm) - currentOdometer);
  const daysRemaining = Math.round(kmRemaining / kmPerDay);
  return { date: addDays(new Date().toISOString().slice(0, 10), daysRemaining), km_remaining: kmRemaining, source: 'km_projection' };
}

/**
 * Próximo cambio de llantas: usa el km promedio entre los cambios de llantas
 * históricos de ESTA unidad (category: 'tires') cuando hay ≥2; si no hay
 * suficiente historial, cae al ajuste tire_life_km del tenant.
 */
function estimateNextTire(vehicle: any, allMaint: any[], fuelLogs: any[], tireLifeKm: number) {
  const tireChanges = allMaint
    .filter((m) => m.vehicle_id === vehicle.id && m.category === 'tires' && m.odometer != null)
    .sort((a, b) => (a.odometer as number) - (b.odometer as number));

  const kmPerDay = avgDailyKm(vehicle.id, fuelLogs);
  const currentOdometer = vehicle.odometer ?? (tireChanges.at(-1)?.odometer ?? null);
  if (currentOdometer == null) return { date: null, km_remaining: null };

  let avgLifeKm = tireLifeKm;
  let lastChangeOdometer = 0;
  if (tireChanges.length >= 2) {
    const deltas = tireChanges.slice(1).map((m, i) => m.odometer - tireChanges[i].odometer);
    avgLifeKm = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    lastChangeOdometer = tireChanges.at(-1)!.odometer;
  } else if (tireChanges.length === 1) {
    lastChangeOdometer = tireChanges[0].odometer;
  }

  const kmRemaining = Math.max(0, (lastChangeOdometer + avgLifeKm) - currentOdometer);
  if (kmPerDay == null) return { date: null, km_remaining: kmRemaining };
  const daysRemaining = Math.round(kmRemaining / kmPerDay);
  return { date: addDays(new Date().toISOString().slice(0, 10), daysRemaining), km_remaining: kmRemaining };
}
