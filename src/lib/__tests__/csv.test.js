import { describe, it, expect } from 'vitest';
import { parseCSV, rowErrors, partitionRows } from '@/lib/csv';

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
