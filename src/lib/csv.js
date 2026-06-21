/**
 * Parser de CSV robusto y utilidades de importación.
 *
 * El parser anterior hacía `split(',')`, así que se rompía con comas dentro de
 * comillas, comillas escapadas, saltos CRLF o BOM. Este maneja todo eso y es una
 * función pura para poder probarlo a fondo. La validación por fila permite
 * importar sólo los registros buenos y reportar exactamente qué falló.
 */

/**
 * Parsea CSV a { headers, rows }. Soporta campos entre comillas con comas y
 * saltos de línea, comillas escapadas (""), CRLF y BOM. Los encabezados se
 * normalizan a minúsculas sin espacios alrededor.
 *
 * @param {string} text
 * @returns {{ headers: string[], rows: Record<string,string>[] }}
 */
export function parseCSV(text) {
  const clean = (text || '').replace(/^﻿/, ''); // quita BOM
  if (!clean.trim()) return { headers: [], rows: [] };

  const records = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; } // comilla escapada
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      record.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      // Fin de registro; absorbe \r\n como uno solo.
      if (c === '\r' && clean[i + 1] === '\n') i++;
      record.push(field); field = '';
      records.push(record); record = [];
    } else {
      field += c;
    }
  }
  // Último campo/registro si no terminó en salto de línea.
  if (field.length > 0 || record.length > 0) { record.push(field); records.push(record); }

  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim().toLowerCase());
  const rows = records
    .slice(1)
    .filter((r) => r.some((v) => (v || '').trim() !== '')) // ignora líneas vacías
    .map((values) => {
      /** @type {Record<string,string>} */
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim(); });
      return obj;
    });
  return { headers, rows };
}

/** Columnas requeridas/esperadas por tipo de importación. */
export const IMPORT_COLUMNS = {
  drivers: ['nombre', 'licencia', 'vencimiento_licencia', 'telefono', 'fecha_contratacion'],
  vehicles: ['no_unidad', 'placa', 'marca', 'modelo', 'año', 'vin', 'conductor_asignado'],
};

/**
 * Valida una fila según el tipo. Devuelve un array de errores (vacío = válida).
 * - drivers: requiere `nombre`.
 * - vehicles: requiere `placa` o `no_unidad`; `año` (si viene) debe ser numérico.
 *
 * @param {string} type
 * @param {Record<string,string>} row
 * @returns {string[]}
 */
export function rowErrors(type, row) {
  const errors = [];
  if (type === 'drivers') {
    if (!row['nombre']?.trim()) errors.push('falta el nombre');
  } else if (type === 'vehicles') {
    if (!row['placa']?.trim() && !row['no_unidad']?.trim()) errors.push('falta placa o número de unidad');
    if (row['año']?.trim() && Number.isNaN(Number(row['año']))) errors.push('el año no es un número');
  }
  return errors;
}

/**
 * Particiona las filas en válidas e inválidas (con su número de línea de CSV,
 * empezando en 2 porque la 1 es el encabezado).
 *
 * @param {string} type
 * @param {Record<string,string>[]} rows
 * @returns {{ valid: Record<string,string>[], invalid: { line: number, errors: string[] }[] }}
 */
export function partitionRows(type, rows) {
  const valid = [];
  const invalid = [];
  rows.forEach((row, i) => {
    const errs = rowErrors(type, row);
    if (errs.length === 0) valid.push(row);
    else invalid.push({ line: i + 2, errors: errs });
  });
  return { valid, invalid };
}
