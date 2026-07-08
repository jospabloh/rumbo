import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  analyzeImport,
  buildTemplate,
  isExampleRow,
  rowErrors,
  IMPORT_SPECS,
  IMPORT_TYPES,
  EXAMPLE_PREFIX,
} from '@/lib/csv';

describe('buildTemplate', () => {
  it('produces a header + one example row marked with "#" for every type', () => {
    for (const type of IMPORT_TYPES) {
      const csv = buildTemplate(type);
      const { headers, rows } = parseCSV(csv);
      expect(headers).toEqual(IMPORT_SPECS[type].columns);
      expect(rows).toHaveLength(1); // solo la fila de ejemplo
      expect(rows[0][headers[0]].startsWith(EXAMPLE_PREFIX)).toBe(true);
    }
  });

  it('the example row in a template is ignored by the importer', () => {
    const { rows } = parseCSV(buildTemplate('drivers'));
    const res = analyzeImport('drivers', rows, []);
    expect(res.examplesSkipped).toBe(1);
    expect(res.toImport).toHaveLength(0);
  });
});

describe('isExampleRow', () => {
  it('detects rows whose first column starts with "#"', () => {
    expect(isExampleRow('drivers', { nombre: '# Juan Pérez' })).toBe(true);
    expect(isExampleRow('drivers', { nombre: 'Juan Pérez' })).toBe(false);
    expect(isExampleRow('vehicles', { no_unidad: '# U-01' })).toBe(true);
    expect(isExampleRow('vehicles', { no_unidad: 'U-01' })).toBe(false);
  });
});

describe('analyzeImport — dedup', () => {
  it('skips rows that already exist in the tenant (no duplicates)', () => {
    const rows = [
      { placa: 'ABC-1234', marca: 'Nissan' }, // ya existe
      { placa: 'XYZ-9999', marca: 'Toyota' }, // nueva
    ];
    const existing = [{ plate: 'ABC-1234' }];
    const res = analyzeImport('vehicles', rows, existing);
    expect(res.toImport.map((t) => t.row.placa)).toEqual(['XYZ-9999']);
    expect(res.duplicatesExisting).toHaveLength(1);
    expect(res.duplicatesExisting[0].line).toBe(2);
  });

  it('collapses duplicates within the same file to a single import', () => {
    const rows = [
      { nombre: 'Ana', licencia: 'LIC-1' },
      { nombre: 'Ana otra vez', licencia: 'LIC-1' }, // misma licencia
      { nombre: 'Beto', licencia: 'LIC-2' },
    ];
    const res = analyzeImport('drivers', rows, []);
    expect(res.toImport).toHaveLength(2);
    expect(res.duplicatesInFile).toHaveLength(1);
    expect(res.duplicatesInFile[0].line).toBe(3);
  });

  it('re-uploading the same file a second time imports nothing new', () => {
    const rows = [
      { nombre: 'Ana', licencia: 'LIC-1' },
      { nombre: 'Beto', licencia: 'LIC-2' },
    ];
    const first = analyzeImport('drivers', rows, []);
    const created = first.toImport.map((t) => IMPORT_SPECS.drivers.buildPayload(t.row, 'T1'));
    const second = analyzeImport('drivers', rows, created);
    expect(second.toImport).toHaveLength(0);
    expect(second.duplicatesExisting).toHaveLength(2);
  });

  it('falls back to name+phone when a driver has no license number', () => {
    const rows = [
      { nombre: 'Sin Licencia', telefono: '555' },
      { nombre: 'Sin Licencia', telefono: '555' },
    ];
    const res = analyzeImport('drivers', rows, []);
    expect(res.toImport).toHaveLength(1);
    expect(res.duplicatesInFile).toHaveLength(1);
  });
});

describe('analyzeImport — validation with remediation', () => {
  it('reports invalid rows with a human fix and keeps CSV line numbers', () => {
    const rows = [
      { nombre: 'Ok' },
      { nombre: '' }, // falta nombre
    ];
    const res = analyzeImport('drivers', rows, []);
    expect(res.toImport).toHaveLength(1);
    expect(res.invalid).toHaveLength(1);
    expect(res.invalid[0].line).toBe(3);
    expect(res.invalid[0].errors[0].msg).toContain('nombre');
    expect(res.invalid[0].errors[0].fix.length).toBeGreaterThan(0);
  });

  it('requires stock for parts and category+label for catalog', () => {
    expect(rowErrors('parts', { nombre: 'Filtro' })).toContain('falta el stock');
    expect(rowErrors('parts', { nombre: 'Filtro', stock: '3' })).toEqual([]);
    expect(rowErrors('catalog', { categoria: 'x' })).toContain('falta la etiqueta');
    expect(rowErrors('catalog', { categoria: 'x', etiqueta: 'y' })).toEqual([]);
  });
});

describe('buildPayload — normalization', () => {
  it('normalizes vehicle plate/vin to uppercase and year to a number', () => {
    const payload = IMPORT_SPECS.vehicles.buildPayload(
      { placa: 'abc-1', vin: 'jn1', 'año': '2022', tarifa_renta: '1500', frecuencia_renta: 'diaria' },
      'T1',
    );
    expect(payload.plate).toBe('ABC-1');
    expect(payload.vin).toBe('JN1');
    expect(payload.year).toBe(2022);
    expect(payload.rent_amount).toBe(1500);
    expect(payload.rent_frequency).toBe('daily');
    expect(payload.tenant_id).toBe('T1');
  });

  it('coerces part stock and cost to numbers with sane defaults', () => {
    const payload = IMPORT_SPECS.parts.buildPayload({ nombre: 'Filtro', stock: '10' }, 'T1');
    expect(payload.stock).toBe(10);
    expect(payload.min_stock).toBe(0);
    expect(payload.unit_cost).toBeNull();
  });

  it('defaults catalog active to true and parses order', () => {
    const on = IMPORT_SPECS.catalog.buildPayload({ categoria: 'c', etiqueta: 'l', orden: '2' }, 'T1');
    expect(on.active).toBe(true);
    expect(on.sort_order).toBe(2);
    const off = IMPORT_SPECS.catalog.buildPayload({ categoria: 'c', etiqueta: 'l', activo: 'false' }, 'T1');
    expect(off.active).toBe(false);
  });

  it('round-trips a driver\'s aval, background-check date and rating', () => {
    const payload = IMPORT_SPECS.drivers.buildPayload(
      { nombre: 'Ana', aval: 'María López', fecha_antecedentes: '2024-01-10', calificacion: '4.8' },
      'T1',
    );
    expect(payload.aval_name).toBe('María López');
    expect(payload.background_check_date).toBe('2024-01-10');
    expect(payload.rating).toBe(4.8);
  });

  it('maps vehicle dia_cobro (ES) to the English rent_day enum, and estado to status', () => {
    const payload = IMPORT_SPECS.vehicles.buildPayload({ placa: 'ABC-1', dia_cobro: 'miercoles', estado: 'mantenimiento' }, 'T1');
    expect(payload.rent_day).toBe('wednesday');
    expect(payload.status).toBe('maintenance');
    expect(rowErrors('vehicles', { placa: 'ABC-1', dia_cobro: 'not-a-day' })).toContain('día de cobro inválido');
  });

  it('carries the new vehicle insurance/odometer columns through unchanged', () => {
    const payload = IMPORT_SPECS.vehicles.buildPayload(
      { placa: 'ABC-1', no_poliza_seguro: 'POL-1', aseguradora: 'GNP', costo_anual_seguro: '1894', odometro: '107874' },
      'T1',
    );
    expect(payload.insurance_policy_no).toBe('POL-1');
    expect(payload.insurance_company).toBe('GNP');
    expect(payload.insurance_annual_cost).toBe(1894);
    expect(payload.odometer).toBe(107874);
  });

  it('maps maintenance categoria (ES) to the English category enum', () => {
    const payload = IMPORT_SPECS.maintenance.buildPayload({ placa: 'ABC-1', categoria: 'llantas' }, 'T1');
    expect(payload.category).toBe('tires');
    expect(rowErrors('maintenance', { placa: 'ABC-1', categoria: 'not-a-category' })).toContain('la categoría no es válida');
  });

  it('maps maintenance tipo "arreglo_mayor" to kind "major_repair"', () => {
    const payload = IMPORT_SPECS.maintenance.buildPayload({ placa: 'ABC-1', tipo: 'arreglo_mayor' }, 'T1');
    expect(payload.kind).toBe('major_repair');
  });
});
