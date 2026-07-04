/**
 * Parser de CSV robusto y utilidades de importación de catálogo.
 *
 * El parser maneja comas dentro de comillas, comillas escapadas (""), CRLF y BOM,
 * y es una función pura para poder probarlo a fondo.
 *
 * La importación es dirigida por configuración (IMPORT_SPECS): cada tipo de dato
 * (conductores, vehículos, refacciones, catálogos) declara sus columnas, campos
 * requeridos, una fila de EJEMPLO para la plantilla, cómo construir el registro y
 * su "llave natural" para detectar duplicados. Así el importador soporta todo el
 * catálogo sin lógica duplicada y agregar un tipo nuevo es una sola entrada aquí.
 *
 * Reglas clave que pide el negocio:
 *   - Toda plantilla trae ≥1 fila de ejemplo que el importador IGNORA (se marca con
 *     `#` al inicio de la primera columna; ver isExampleRow / EXAMPLE_PREFIX).
 *   - Si el usuario sube el mismo archivo varias veces NO se crean duplicados: cada
 *     fila se compara por su llave natural contra los registros ya existentes del
 *     tenant y contra las filas previas del propio archivo.
 *   - Al terminar se informa qué se logró y, si algo falló, por qué y cómo remediarlo.
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

// ---------------------------------------------------------------------------
// Configuración de importación por tipo de dato
// ---------------------------------------------------------------------------

/**
 * Prefijo con el que se marca la fila de ejemplo de cada plantilla. El importador
 * ignora cualquier fila cuya PRIMERA columna empiece con `#`, así el usuario puede
 * dejar la fila de ejemplo (o escribir sus propios comentarios) sin que se suban.
 */
export const EXAMPLE_PREFIX = '#';

const norm = (v) => (v == null ? '' : String(v)).trim();
const upper = (v) => norm(v).toUpperCase();
const parseNum = (v) => {
  const n = Number(norm(v));
  return norm(v) === '' || Number.isNaN(n) ? null : n;
};

// ---------------------------------------------------------------------------
// Resolución de referencias (importaciones que apuntan a un vehículo/conductor
// YA existente, p. ej. combustible, multas, mantenimientos).
//
// La página de importación arma un índice (`ctx`) con los registros del tenant y
// lo pasa a analyzeImport; las specs lo usan para (a) validar que la referencia
// exista, (b) resolver el id al construir el registro y (c) deduplicar por id.
// Sin ctx (llamadas de compatibilidad) las specs solo validan la estructura.
//   ctx = { vehicleByPlate, vehicleByUnit, driverByLicense, driverByName } (Map<MAYÚS, record>)
// ---------------------------------------------------------------------------

/** Encuentra el vehículo referenciado por la fila (por placa, luego no_unidad). */
function findVehicle(row, ctx) {
  const plate = upper(row['placa']);
  if (plate && ctx?.vehicleByPlate?.has(plate)) return ctx.vehicleByPlate.get(plate);
  const unit = upper(row['no_unidad']);
  if (unit && ctx?.vehicleByUnit?.has(unit)) return ctx.vehicleByUnit.get(unit);
  return null;
}

/** Encuentra el conductor referenciado (una sola columna: licencia o nombre). */
function findDriver(row, ctx) {
  const ref = upper(row['conductor']);
  if (!ref) return null;
  return ctx?.driverByLicense?.get(ref) || ctx?.driverByName?.get(ref) || null;
}

/**
 * Construye el índice de referencias (`ctx`) a partir de las listas del tenant.
 * Se exporta para que la página de importación lo arme una sola vez por archivo.
 *
 * @param {any[]} [vehicles]
 * @param {any[]} [drivers]
 */
export function buildRefIndex(vehicles = [], drivers = []) {
  const vehicleByPlate = new Map();
  const vehicleByUnit = new Map();
  for (const v of vehicles) {
    if (v?.plate) vehicleByPlate.set(upper(v.plate), v);
    if (v?.unit_number) vehicleByUnit.set(upper(v.unit_number), v);
  }
  const driverByLicense = new Map();
  const driverByName = new Map();
  for (const d of drivers) {
    if (d?.license_no) driverByLicense.set(upper(d.license_no), d);
    if (d?.full_name) driverByName.set(upper(d.full_name), d);
  }
  return { vehicleByPlate, vehicleByUnit, driverByLicense, driverByName };
}

/**
 * Especificaciones de importación. Cada una:
 *  - `entity`: nombre de la entidad Base44.
 *  - `label`: etiqueta para la UI.
 *  - `columns`: encabezados esperados del CSV (en minúsculas, orden de plantilla).
 *  - `example`: valores de la fila de ejemplo (se le antepone `#` a la 1ª columna).
 *  - `validate(row)`: array de errores { msg, fix } (vacío = fila válida).
 *  - `buildPayload(row, tenantId)`: registro listo para `entity.create`.
 *  - `keyOfRow(row)` / `keyOfRecord(rec)`: llave natural para deduplicar. `null`
 *    significa "sin llave" (no se puede deduplicar esa fila; se importa siempre).
 *  - `keyLabel`: nombre humano de la llave, para explicar los duplicados.
 */
export const IMPORT_SPECS = {
  drivers: {
    entity: 'Driver',
    label: 'Conductores',
    keyLabel: 'licencia (o nombre + teléfono)',
    columns: ['nombre', 'licencia', 'vencimiento_licencia', 'telefono', 'fecha_contratacion'],
    example: {
      nombre: 'Juan Pérez',
      licencia: 'LIC-0001',
      vencimiento_licencia: '2027-05-30',
      telefono: '55-1234-5678',
      fecha_contratacion: '2024-01-15',
    },
    validate(row) {
      const errors = [];
      if (!norm(row['nombre'])) {
        errors.push({ msg: 'falta el nombre', fix: 'Escribe el nombre completo del conductor en la columna "nombre".' });
      }
      if (norm(row['vencimiento_licencia']) && !isDateish(row['vencimiento_licencia'])) {
        errors.push({ msg: 'la fecha de vencimiento no es válida', fix: 'Usa el formato AAAA-MM-DD (ej. 2027-05-30) o deja la celda vacía.' });
      }
      return errors;
    },
    buildPayload(row, tenantId) {
      return {
        tenant_id: tenantId,
        full_name: norm(row['nombre']),
        license_no: norm(row['licencia']) || null,
        license_expiry: norm(row['vencimiento_licencia']) || null,
        phone: norm(row['telefono']) || null,
        hire_date: norm(row['fecha_contratacion']) || null,
        status: 'active',
      };
    },
    keyOfRow(row) {
      const lic = upper(row['licencia']);
      if (lic) return `lic:${lic}`;
      const name = upper(row['nombre']);
      if (!name) return null;
      return `np:${name}|${upper(row['telefono'])}`;
    },
    keyOfRecord(rec) {
      const lic = upper(rec.license_no);
      if (lic) return `lic:${lic}`;
      const name = upper(rec.full_name);
      if (!name) return null;
      return `np:${name}|${upper(rec.phone)}`;
    },
  },

  vehicles: {
    entity: 'Vehicle',
    label: 'Vehículos',
    keyLabel: 'placa (o VIN, o número de unidad)',
    // Incluye vencimientos de documentos/permisos para migrarlos junto al vehículo.
    columns: ['no_unidad', 'placa', 'marca', 'modelo', 'año', 'vin', 'vencimiento_seguro', 'vencimiento_registro', 'vencimiento_inspeccion', 'tarifa_renta', 'frecuencia_renta'],
    example: {
      no_unidad: 'U-01',
      placa: 'ABC-1234',
      marca: 'Nissan',
      modelo: 'Versa',
      'año': '2022',
      vin: '3N1CN7AP0KL000000',
      vencimiento_seguro: '2026-12-31',
      vencimiento_registro: '2026-11-30',
      vencimiento_inspeccion: '2026-10-15',
      tarifa_renta: '1500',
      frecuencia_renta: 'weekly',
    },
    validate(row) {
      const errors = [];
      if (!norm(row['placa']) && !norm(row['no_unidad'])) {
        errors.push({ msg: 'falta placa o número de unidad', fix: 'Llena al menos "placa" o "no_unidad" para poder identificar el vehículo.' });
      }
      if (norm(row['año']) && parseNum(row['año']) === null) {
        errors.push({ msg: 'el año no es un número', fix: 'Escribe el año con dígitos (ej. 2022) o deja la celda vacía.' });
      }
      if (norm(row['tarifa_renta']) && parseNum(row['tarifa_renta']) === null) {
        errors.push({ msg: 'la tarifa de renta no es un número', fix: 'Escribe solo el monto en números (ej. 1500) sin símbolos.' });
      }
      const freq = norm(row['frecuencia_renta']).toLowerCase();
      if (freq && freq !== 'weekly' && freq !== 'daily' && freq !== 'semanal' && freq !== 'diaria') {
        errors.push({ msg: 'frecuencia_renta inválida', fix: 'Usa "weekly" (semanal) o "daily" (diaria), o deja la celda vacía.' });
      }
      return errors;
    },
    buildPayload(row, tenantId) {
      const freqRaw = norm(row['frecuencia_renta']).toLowerCase();
      const frequency = freqRaw === 'daily' || freqRaw === 'diaria' ? 'daily'
        : (freqRaw ? 'weekly' : null);
      return {
        tenant_id: tenantId,
        unit_number: norm(row['no_unidad']) || null,
        plate: upper(row['placa']) || null,
        make: norm(row['marca']) || null,
        model: norm(row['modelo']) || null,
        year: parseNum(row['año']),
        vin: upper(row['vin']) || null,
        insurance_expiry: norm(row['vencimiento_seguro']) || null,
        registration_expiry: norm(row['vencimiento_registro']) || null,
        inspection_expiry: norm(row['vencimiento_inspeccion']) || null,
        rent_amount: parseNum(row['tarifa_renta']),
        rent_frequency: frequency,
        status: 'active',
      };
    },
    keyOfRow(row) {
      const plate = upper(row['placa']);
      if (plate) return `plate:${plate}`;
      const vin = upper(row['vin']);
      if (vin) return `vin:${vin}`;
      const unit = upper(row['no_unidad']);
      return unit ? `unit:${unit}` : null;
    },
    keyOfRecord(rec) {
      const plate = upper(rec.plate);
      if (plate) return `plate:${plate}`;
      const vin = upper(rec.vin);
      if (vin) return `vin:${vin}`;
      const unit = upper(rec.unit_number);
      return unit ? `unit:${unit}` : null;
    },
  },

  fuel: {
    entity: 'FuelLog',
    label: 'Combustible',
    keyLabel: 'placa + fecha + costo',
    needsRefs: true,
    columns: ['placa', 'conductor', 'fecha', 'litros', 'precio_litro', 'costo_total', 'odometro'],
    example: {
      placa: 'ABC-1234',
      conductor: 'LIC-0001',
      fecha: '2026-06-15',
      litros: '40',
      precio_litro: '23.50',
      costo_total: '940',
      odometro: '85000',
    },
    validate(row, ctx) {
      const errors = [];
      if (!norm(row['placa'])) {
        errors.push({ msg: 'falta la placa', fix: 'Escribe la placa del vehículo en la columna "placa".' });
      } else if (ctx && !findVehicle(row, ctx)) {
        errors.push({ msg: `no existe un vehículo con placa "${norm(row['placa'])}"`, fix: 'Verifica la placa, o crea/importa primero ese vehículo en Vehículos.' });
      }
      if (norm(row['conductor']) && ctx && !findDriver(row, ctx)) {
        errors.push({ msg: `no se encontró el conductor "${norm(row['conductor'])}"`, fix: 'Usa la licencia o el nombre exacto de un conductor existente, o deja la celda vacía.' });
      }
      if (norm(row['fecha']) && !isDateish(row['fecha'])) {
        errors.push({ msg: 'la fecha no es válida', fix: 'Usa el formato AAAA-MM-DD (ej. 2026-06-15).' });
      }
      if (norm(row['litros']) && parseNum(row['litros']) === null) {
        errors.push({ msg: 'los litros no son un número', fix: 'Escribe la cantidad en números (ej. 40) o deja la celda vacía.' });
      }
      if (norm(row['costo_total']) && parseNum(row['costo_total']) === null) {
        errors.push({ msg: 'el costo total no es un número', fix: 'Escribe solo el monto (ej. 940) sin símbolos.' });
      }
      return errors;
    },
    buildPayload(row, tenantId, ctx) {
      const v = findVehicle(row, ctx);
      const d = findDriver(row, ctx);
      return {
        tenant_id: tenantId,
        vehicle_id: v?.id || null,
        driver_id: d?.id || null,
        liters: parseNum(row['litros']),
        price_per_liter: parseNum(row['precio_litro']),
        total_cost: parseNum(row['costo_total']),
        logged_at: norm(row['fecha']) || null,
        odometer: parseNum(row['odometro']),
      };
    },
    keyOfRow(row, ctx) {
      const v = findVehicle(row, ctx);
      const f = norm(row['fecha']);
      if (!v || !f) return null;
      return `fuel:${v.id}|${f}|${parseNum(row['costo_total'])}`;
    },
    keyOfRecord(rec) {
      if (!rec?.vehicle_id || !rec?.logged_at) return null;
      return `fuel:${rec.vehicle_id}|${rec.logged_at}|${rec.total_cost ?? ''}`;
    },
  },

  fines: {
    entity: 'Fine',
    label: 'Multas',
    keyLabel: 'placa + fecha + monto',
    needsRefs: true,
    columns: ['placa', 'conductor', 'tipo', 'monto', 'puntos', 'fecha', 'pagada'],
    example: {
      placa: 'ABC-1234',
      conductor: 'LIC-0001',
      tipo: 'Exceso de velocidad',
      monto: '1500',
      puntos: '3',
      fecha: '2026-06-10',
      pagada: 'no',
    },
    validate(row, ctx) {
      const errors = [];
      if (!norm(row['placa'])) {
        errors.push({ msg: 'falta la placa', fix: 'Escribe la placa del vehículo en la columna "placa".' });
      } else if (ctx && !findVehicle(row, ctx)) {
        errors.push({ msg: `no existe un vehículo con placa "${norm(row['placa'])}"`, fix: 'Verifica la placa, o crea/importa primero ese vehículo.' });
      }
      if (!norm(row['conductor'])) {
        errors.push({ msg: 'falta el conductor', fix: 'Escribe la licencia o el nombre del conductor en la columna "conductor".' });
      } else if (ctx && !findDriver(row, ctx)) {
        errors.push({ msg: `no se encontró el conductor "${norm(row['conductor'])}"`, fix: 'Usa la licencia o el nombre exacto de un conductor existente.' });
      }
      const amount = parseNum(row['monto']);
      if (norm(row['monto']) === '') {
        errors.push({ msg: 'falta el monto', fix: 'Escribe el monto de la multa (ej. 1500) en la columna "monto".' });
      } else if (amount === null || amount <= 0) {
        errors.push({ msg: 'el monto no es válido', fix: 'Escribe un número mayor a 0 en "monto".' });
      }
      if (norm(row['fecha']) && !isDateish(row['fecha'])) {
        errors.push({ msg: 'la fecha no es válida', fix: 'Usa el formato AAAA-MM-DD (ej. 2026-06-10).' });
      }
      return errors;
    },
    buildPayload(row, tenantId, ctx) {
      const v = findVehicle(row, ctx);
      const d = findDriver(row, ctx);
      const paid = norm(row['pagada']).toLowerCase();
      return {
        tenant_id: tenantId,
        vehicle_id: v?.id || null,
        driver_id: d?.id || null,
        fine_type: norm(row['tipo']) || null,
        amount: parseNum(row['monto']),
        points: parseNum(row['puntos']) ?? 0,
        issued_at: norm(row['fecha']) || null,
        paid: ['true', '1', 'si', 'sí', 'yes', 'pagada'].includes(paid),
      };
    },
    keyOfRow(row, ctx) {
      const v = findVehicle(row, ctx);
      const f = norm(row['fecha']);
      if (!v || !f) return null;
      return `fine:${v.id}|${f}|${parseNum(row['monto'])}`;
    },
    keyOfRecord(rec) {
      if (!rec?.vehicle_id || !rec?.issued_at) return null;
      return `fine:${rec.vehicle_id}|${rec.issued_at}|${rec.amount ?? ''}`;
    },
  },

  maintenance: {
    entity: 'Maintenance',
    label: 'Mantenimientos',
    keyLabel: 'placa + fecha + descripción',
    needsRefs: true,
    columns: ['placa', 'tipo', 'descripcion', 'costo', 'fecha', 'proximo_servicio', 'odometro'],
    example: {
      placa: 'ABC-1234',
      tipo: 'preventivo',
      descripcion: 'Cambio de aceite',
      costo: '1200',
      fecha: '2026-06-01',
      proximo_servicio: '2026-09-01',
      odometro: '85000',
    },
    validate(row, ctx) {
      const errors = [];
      if (!norm(row['placa'])) {
        errors.push({ msg: 'falta la placa', fix: 'Escribe la placa del vehículo en la columna "placa".' });
      } else if (ctx && !findVehicle(row, ctx)) {
        errors.push({ msg: `no existe un vehículo con placa "${norm(row['placa'])}"`, fix: 'Verifica la placa, o crea/importa primero ese vehículo.' });
      }
      const tipo = norm(row['tipo']).toLowerCase();
      if (tipo && !['preventivo', 'correctivo', 'preventive', 'corrective'].includes(tipo)) {
        errors.push({ msg: 'el tipo no es válido', fix: 'Usa "preventivo" o "correctivo", o deja la celda vacía.' });
      }
      if (norm(row['costo']) && parseNum(row['costo']) === null) {
        errors.push({ msg: 'el costo no es un número', fix: 'Escribe solo el monto (ej. 1200) sin símbolos.' });
      }
      if (norm(row['fecha']) && !isDateish(row['fecha'])) {
        errors.push({ msg: 'la fecha no es válida', fix: 'Usa el formato AAAA-MM-DD (ej. 2026-06-01).' });
      }
      if (norm(row['proximo_servicio']) && !isDateish(row['proximo_servicio'])) {
        errors.push({ msg: 'la fecha de próximo servicio no es válida', fix: 'Usa AAAA-MM-DD o deja la celda vacía.' });
      }
      return errors;
    },
    buildPayload(row, tenantId, ctx) {
      const v = findVehicle(row, ctx);
      const tipo = norm(row['tipo']).toLowerCase();
      const kind = tipo === 'correctivo' || tipo === 'corrective' ? 'corrective' : 'preventive';
      return {
        tenant_id: tenantId,
        vehicle_id: v?.id || null,
        kind,
        description: norm(row['descripcion']) || null,
        cost: parseNum(row['costo']),
        performed_at: norm(row['fecha']) || null,
        next_due_at: norm(row['proximo_servicio']) || null,
        odometer: parseNum(row['odometro']),
      };
    },
    keyOfRow(row, ctx) {
      const v = findVehicle(row, ctx);
      const f = norm(row['fecha']);
      if (!v || !f) return null;
      return `mnt:${v.id}|${f}|${upper(row['descripcion'])}`;
    },
    keyOfRecord(rec) {
      if (!rec?.vehicle_id || !rec?.performed_at) return null;
      return `mnt:${rec.vehicle_id}|${rec.performed_at}|${upper(rec.description)}`;
    },
  },

  parts: {
    entity: 'Part',
    label: 'Refacciones',
    keyLabel: 'SKU (o nombre + marca)',
    columns: ['nombre', 'marca', 'sku', 'no_unidad', 'stock', 'min_stock', 'costo_unitario'],
    example: {
      nombre: 'Filtro de aceite',
      marca: 'Bosch',
      sku: 'FO-1234',
      no_unidad: '',
      stock: '10',
      min_stock: '3',
      costo_unitario: '120',
    },
    validate(row) {
      const errors = [];
      if (!norm(row['nombre'])) {
        errors.push({ msg: 'falta el nombre', fix: 'Escribe el nombre de la refacción en la columna "nombre".' });
      }
      const stock = parseNum(row['stock']);
      if (norm(row['stock']) === '') {
        errors.push({ msg: 'falta el stock', fix: 'Escribe la cantidad en existencia (ej. 0, 5, 10) en la columna "stock".' });
      } else if (stock === null || stock < 0) {
        errors.push({ msg: 'el stock no es un número válido', fix: 'Escribe un número mayor o igual a 0 en "stock".' });
      }
      if (norm(row['costo_unitario']) && parseNum(row['costo_unitario']) === null) {
        errors.push({ msg: 'el costo unitario no es un número', fix: 'Escribe solo el monto en números (ej. 120) o deja la celda vacía.' });
      }
      return errors;
    },
    buildPayload(row, tenantId) {
      return {
        tenant_id: tenantId,
        name: norm(row['nombre']),
        brand: norm(row['marca']) || null,
        sku: norm(row['sku']) || null,
        unit_number: norm(row['no_unidad']) || null,
        stock: parseNum(row['stock']) ?? 0,
        min_stock: parseNum(row['min_stock']) ?? 0,
        unit_cost: parseNum(row['costo_unitario']),
      };
    },
    keyOfRow(row) {
      const sku = upper(row['sku']);
      if (sku) return `sku:${sku}`;
      const name = upper(row['nombre']);
      if (!name) return null;
      return `nb:${name}|${upper(row['marca'])}`;
    },
    keyOfRecord(rec) {
      const sku = upper(rec.sku);
      if (sku) return `sku:${sku}`;
      const name = upper(rec.name);
      if (!name) return null;
      return `nb:${name}|${upper(rec.brand)}`;
    },
  },

  catalog: {
    entity: 'Catalog',
    label: 'Catálogos (listas)',
    keyLabel: 'categoría + etiqueta',
    columns: ['categoria', 'etiqueta', 'activo', 'orden'],
    example: {
      categoria: 'fine_type',
      etiqueta: 'Exceso de velocidad',
      activo: 'true',
      orden: '1',
    },
    validate(row) {
      const errors = [];
      if (!norm(row['categoria'])) {
        errors.push({ msg: 'falta la categoría', fix: 'Escribe la categoría (ej. fine_type, payment_method, vehicle_make) en "categoria".' });
      }
      if (!norm(row['etiqueta'])) {
        errors.push({ msg: 'falta la etiqueta', fix: 'Escribe el texto de la opción en la columna "etiqueta".' });
      }
      if (norm(row['orden']) && parseNum(row['orden']) === null) {
        errors.push({ msg: 'el orden no es un número', fix: 'Escribe un número (ej. 1, 2, 3) en "orden" o deja la celda vacía.' });
      }
      return errors;
    },
    buildPayload(row, tenantId) {
      const activo = norm(row['activo']).toLowerCase();
      return {
        tenant_id: tenantId,
        category: norm(row['categoria']),
        label: norm(row['etiqueta']),
        active: activo === '' ? true : !['false', '0', 'no'].includes(activo),
        sort_order: parseNum(row['orden']) ?? 0,
      };
    },
    keyOfRow(row) {
      const cat = upper(row['categoria']);
      const label = upper(row['etiqueta']);
      if (!cat || !label) return null;
      return `cat:${cat}|${label}`;
    },
    keyOfRecord(rec) {
      const cat = upper(rec.category);
      const label = upper(rec.label);
      if (!cat || !label) return null;
      return `cat:${cat}|${label}`;
    },
  },
};

/** Tipos de importación disponibles, en orden de aparición en la UI. */
export const IMPORT_TYPES = Object.keys(IMPORT_SPECS);

/** Compat: mapa tipo → columnas (lo usaban versiones previas del importador). */
export const IMPORT_COLUMNS = Object.fromEntries(
  IMPORT_TYPES.map((t) => [t, IMPORT_SPECS[t].columns]),
);

/** Heurística ligera de fecha AAAA-MM-DD (no exige un calendario válido estricto). */
function isDateish(v) {
  const s = norm(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  // Acepta también DD/MM/AAAA por si el usuario exporta así (se guarda tal cual).
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return true;
  return false;
}

/**
 * ¿La fila es una fila de ejemplo/comentario que el importador debe ignorar?
 * Se marca poniendo `#` al inicio de la PRIMERA columna de la plantilla.
 *
 * @param {string} type
 * @param {Record<string,string>} row
 * @returns {boolean}
 */
export function isExampleRow(type, row) {
  const spec = IMPORT_SPECS[type];
  if (!spec) return false;
  const first = spec.columns[0];
  return norm(row[first]).startsWith(EXAMPLE_PREFIX);
}

/**
 * Escapa un valor para CSV (comillas si contiene coma, comilla o salto de línea).
 */
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Construye la plantilla CSV de un tipo: encabezados + 1 fila de ejemplo marcada
 * con `#` (que el importador ignora). El usuario llena sus filas debajo.
 *
 * @param {string} type
 * @returns {string} contenido CSV
 */
export function buildTemplate(type) {
  const spec = IMPORT_SPECS[type];
  if (!spec) return '';
  const header = spec.columns.map(csvCell).join(',');
  const ex = spec.columns.map((c, i) => {
    const val = spec.example?.[c] ?? '';
    // Marca la fila como ejemplo anteponiendo `#` a la primera columna.
    return csvCell(i === 0 ? `${EXAMPLE_PREFIX} ${val}`.trim() : val);
  }).join(',');
  return `${header}\n${ex}\n`;
}

/**
 * Valida una fila y devuelve solo los mensajes de error (compat con la API previa
 * y con las pruebas existentes). Para conductores/vehículos conserva exactamente
 * los mismos textos que antes.
 *
 * @param {string} type
 * @param {Record<string,string>} row
 * @returns {string[]}
 */
export function rowErrors(type, row) {
  const spec = IMPORT_SPECS[type];
  if (!spec) return [];
  return spec.validate(row).map((e) => e.msg);
}

/**
 * Particiona filas en válidas/ inválidas con su número de línea de CSV (la fila 1
 * es el encabezado, así que la primera fila de datos es la línea 2). Mantiene la
 * firma previa; NO filtra filas de ejemplo (para eso usa analyzeImport).
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

/**
 * Analiza un archivo completo para importar: ignora filas de ejemplo, valida,
 * y deduplica tanto contra los registros ya existentes del tenant como dentro del
 * propio archivo. Devuelve todo lo necesario para previsualizar e informar.
 *
 * @param {string} type
 * @param {Record<string,string>[]} rows            filas parseadas (en orden del archivo)
 * @param {any[]} [existingRecords]                 registros ya existentes del tenant
 * @param {object|null} [ctx]                        índice de referencias (buildRefIndex)
 *   para importaciones que apuntan a vehículo/conductor; null para las que no.
 * @returns {{
 *   type: string,
 *   spec: any,
 *   total: number,
 *   examplesSkipped: number,
 *   toImport: { row: Record<string,string>, line: number, key: string|null }[],
 *   invalid: { line: number, errors: { msg: string, fix: string }[] }[],
 *   duplicatesExisting: { line: number, key: string }[],
 *   duplicatesInFile: { line: number, key: string }[],
 * }}
 */
export function analyzeImport(type, rows, existingRecords = [], ctx = null) {
  const spec = IMPORT_SPECS[type];
  if (!spec) throw new Error(`Tipo de importación desconocido: ${type}`);

  const existingKeys = new Set(
    (existingRecords || [])
      .map((r) => spec.keyOfRecord(r))
      .filter(Boolean),
  );

  const seenInFile = new Set();
  const toImport = [];
  const invalid = [];
  const duplicatesExisting = [];
  const duplicatesInFile = [];
  let examplesSkipped = 0;

  rows.forEach((row, i) => {
    const line = i + 2; // +2: la línea 1 es el encabezado

    if (isExampleRow(type, row)) { examplesSkipped++; return; }

    const errs = spec.validate(row, ctx);
    if (errs.length) { invalid.push({ line, errors: errs }); return; }

    const key = spec.keyOfRow(row, ctx);
    if (key && existingKeys.has(key)) { duplicatesExisting.push({ line, key }); return; }
    if (key && seenInFile.has(key)) { duplicatesInFile.push({ line, key }); return; }
    if (key) seenInFile.add(key);

    toImport.push({ row, line, key });
  });

  return {
    type,
    spec,
    total: rows.length,
    examplesSkipped,
    toImport,
    invalid,
    duplicatesExisting,
    duplicatesInFile,
  };
}
