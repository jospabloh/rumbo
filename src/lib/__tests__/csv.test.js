import { describe, it, expect } from 'vitest';
import { parseCSV, rowErrors, partitionRows, analyzeImport, buildRefIndex, buildTemplate, IMPORT_SPECS } from '@/lib/csv';

describe('parseCSV', () => {
  it('parses simple rows with lowercased headers', () => {
    const { headers, rows } = parseCSV('Nombre,Telefono\nAna,555\nBeto,666');
    expect(headers).toEqual(['nombre', 'telefono']);
    expect(rows).toEqual([{ nombre: 'Ana', telefono: '555' }, { nombre: 'Beto', telefono: '666' }]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const { rows } = parseCSV('nombre,nota\n"Pérez, Ana","dijo ""hola"""');
    expect(rows[0]).toEqual({ nombre: 'Pérez, Ana', nota: 'dijo "hola"' });
  });

  it('handles quoted newlines, CRLF and BOM', () => {
    const text = '﻿nombre,nota\r\n"Línea1\nLínea2",ok\r\n';
    const { headers, rows } = parseCSV(text);
    expect(headers).toEqual(['nombre', 'nota']);
    expect(rows).toHaveLength(1);
    expect(rows[0].nombre).toBe('Línea1\nLínea2');
    expect(rows[0].nota).toBe('ok');
  });

  it('ignores fully empty lines and trims values', () => {
    const { rows } = parseCSV('nombre\n  Ana  \n\n,\nBeto');
    expect(rows.map((r) => r.nombre)).toEqual(['Ana', 'Beto']);
  });

  it('returns empty on blank input', () => {
    expect(parseCSV('')).toEqual({ headers: [], rows: [] });
    expect(parseCSV('   ')).toEqual({ headers: [], rows: [] });
  });
});

describe('rowErrors', () => {
  it('requires a driver name', () => {
    expect(rowErrors('drivers', { nombre: 'Ana' })).toEqual([]);
    expect(rowErrors('drivers', { nombre: '' })).toHaveLength(1);
  });

  it('requires plate or unit for vehicles and validates year', () => {
    expect(rowErrors('vehicles', { placa: 'ABC123' })).toEqual([]);
    expect(rowErrors('vehicles', { no_unidad: '12' })).toEqual([]);
    expect(rowErrors('vehicles', {})).toEqual(['falta placa o número de unidad']);
    expect(rowErrors('vehicles', { placa: 'X', 'año': 'abcd' })).toEqual(['el año no es un número']);
  });
});

describe('partitionRows', () => {
  it('splits valid from invalid with CSV line numbers', () => {
    const rows = [{ nombre: 'Ana' }, { nombre: '' }, { nombre: 'Beto' }];
    const { valid, invalid } = partitionRows('drivers', rows);
    expect(valid).toHaveLength(2);
    expect(invalid).toEqual([{ line: 3, errors: ['falta el nombre'] }]);
  });
});

describe('importaciones con referencias (combustible/multas/mantenimiento)', () => {
  const vehicles = [{ id: 'v1', plate: 'ABC-1234', unit_number: 'U-01' }];
  const drivers = [{ id: 'd1', license_no: 'LIC-0001', full_name: 'Juan Pérez' }];
  const ctx = buildRefIndex(vehicles, drivers);

  it('resuelve el vehículo por placa y el conductor por licencia', () => {
    const rows = [{ placa: 'ABC-1234', conductor: 'LIC-0001', fecha: '2026-06-15', litros: '40', costo_total: '940' }];
    const a = analyzeImport('fuel', rows, [], ctx);
    expect(a.toImport).toHaveLength(1);
    const payload = IMPORT_SPECS.fuel.buildPayload(a.toImport[0].row, 't1', ctx);
    expect(payload.vehicle_id).toBe('v1');
    expect(payload.driver_id).toBe('d1');
    expect(payload.total_cost).toBe(940);
    expect(payload.tenant_id).toBe('t1');
  });

  it('también resuelve el conductor por nombre exacto', () => {
    const rows = [{ placa: 'ABC-1234', conductor: 'Juan Pérez', tipo: 'Velocidad', monto: '1500', fecha: '2026-06-10' }];
    const a = analyzeImport('fines', rows, [], ctx);
    expect(a.toImport).toHaveLength(1);
  });

  it('marca error cuando la placa no existe en la flota', () => {
    const rows = [{ placa: 'ZZZ-9999', conductor: 'LIC-0001', fecha: '2026-06-15', costo_total: '500' }];
    const a = analyzeImport('fuel', rows, [], ctx);
    expect(a.toImport).toHaveLength(0);
    expect(a.invalid[0].errors[0].msg).toMatch(/no existe un veh/i);
  });

  it('la multa exige conductor y monto > 0', () => {
    const rows = [
      { placa: 'ABC-1234', conductor: '', monto: '100', fecha: '2026-06-10' }, // sin conductor
      { placa: 'ABC-1234', conductor: 'LIC-0001', monto: '0', fecha: '2026-06-10' }, // monto 0
    ];
    const a = analyzeImport('fines', rows, [], ctx);
    expect(a.toImport).toHaveLength(0);
    expect(a.invalid).toHaveLength(2);
  });

  it('deduplica contra registros existentes por (vehículo, fecha, monto)', () => {
    const rows = [{ placa: 'ABC-1234', conductor: 'LIC-0001', tipo: 'X', monto: '1500', fecha: '2026-06-10' }];
    const existing = [{ vehicle_id: 'v1', issued_at: '2026-06-10', amount: 1500 }];
    const a = analyzeImport('fines', rows, existing, ctx);
    expect(a.toImport).toHaveLength(0);
    expect(a.duplicatesExisting).toHaveLength(1);
  });

  it('mapea el tipo de mantenimiento a preventive/corrective', () => {
    const rows = [{ placa: 'ABC-1234', tipo: 'correctivo', descripcion: 'Frenos', costo: '800', fecha: '2026-06-01' }];
    const a = analyzeImport('maintenance', rows, [], ctx);
    expect(a.toImport).toHaveLength(1);
    const payload = IMPORT_SPECS.maintenance.buildPayload(a.toImport[0].row, 't1', ctx);
    expect(payload.kind).toBe('corrective');
    expect(payload.vehicle_id).toBe('v1');
  });

  it('resuelve el vehículo por no_unidad cuando no hay placa', () => {
    const rows = [{ placa: '', no_unidad: 'U-01', tipo: 'preventivo', fecha: '2026-06-01', costo: '300' }];
    // findVehicle usa no_unidad como respaldo; validate exige placa, así que
    // este caso confirma la resolución por unidad a nivel de payload.
    const payload = IMPORT_SPECS.maintenance.buildPayload(rows[0], 't1', ctx);
    expect(payload.vehicle_id).toBe('v1');
  });

  it('cada tipo nuevo genera su plantilla con fila de ejemplo', () => {
    for (const t of ['fuel', 'fines', 'maintenance', 'insurance', 'rentas']) {
      const tpl = buildTemplate(t);
      expect(tpl.split('\n')[0]).toContain('placa');
      expect(tpl).toContain('#'); // fila de ejemplo marcada
    }
  });

  it('seguro: resuelve referencias, mapea estado ES→EN y deduplica', () => {
    const rows = [{ placa: 'ABC-1234', conductor: 'LIC-0001', descripcion: 'Choque', monto: '8000', estado: 'aprobado', fecha: '2026-06-12' }];
    const a = analyzeImport('insurance', rows, [], ctx);
    expect(a.toImport).toHaveLength(1);
    const payload = IMPORT_SPECS.insurance.buildPayload(a.toImport[0].row, 't1', ctx);
    expect(payload.vehicle_id).toBe('v1');
    expect(payload.status).toBe('approved');
    expect(payload.claim_amount).toBe(8000);

    const dup = analyzeImport('insurance', rows, [{ vehicle_id: 'v1', incident_at: '2026-06-12', claim_amount: 8000 }], ctx);
    expect(dup.toImport).toHaveLength(0);
    expect(dup.duplicatesExisting).toHaveLength(1);
  });

  it('seguro: rechaza un estado inválido', () => {
    const rows = [{ placa: 'ABC-1234', descripcion: 'X', monto: '100', estado: 'pendiente', fecha: '2026-06-12' }];
    const a = analyzeImport('insurance', rows, [], ctx);
    expect(a.toImport).toHaveLength(0);
    expect(a.invalid[0].errors.some((e) => /estado no es válido/.test(e.msg))).toBe(true);
  });

  it('renta: calcula el estado según lo pagado vs. lo debido', () => {
    const rows = [
      { placa: 'ABC-1234', conductor: 'LIC-0001', periodo: 'semanal', inicio: '2026-06-01', fin: '2026-06-07', monto: '1500', pagado: '0' },
      { placa: 'ABC-1234', conductor: 'LIC-0001', periodo: 'diaria', inicio: '2026-06-08', monto: '300', pagado: '300' },
      { placa: 'ABC-1234', conductor: 'LIC-0001', periodo: 'semanal', inicio: '2026-06-15', monto: '1500', pagado: '500' },
    ];
    const a = analyzeImport('rentas', rows, [], ctx);
    expect(a.toImport).toHaveLength(3);
    const [p0, p1, p2] = a.toImport.map((it) => IMPORT_SPECS.rentas.buildPayload(it.row, 't1', ctx));
    expect(p0.status).toBe('pending');
    expect(p1.status).toBe('paid');
    expect(p1.period_type).toBe('daily');
    expect(p1.period_end).toBe('2026-06-08'); // fin vacío → usa inicio
    expect(p2.status).toBe('partial');
  });

  it('renta: exige conductor, monto > 0 e inicio', () => {
    const rows = [{ placa: 'ABC-1234', conductor: '', periodo: 'semanal', inicio: '', monto: '0' }];
    const a = analyzeImport('rentas', rows, [], ctx);
    expect(a.toImport).toHaveLength(0);
    expect(a.invalid[0].errors.length).toBeGreaterThanOrEqual(3);
  });
});
