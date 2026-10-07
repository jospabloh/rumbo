import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PLAN_LIMITS,
  PLAN_LABELS,
  vehicleLimit,
  driverLimit,
  atVehicleLimit,
  atDriverLimit,
  quotaCount,
  quotaTone,
} from '../plans.js';

describe('PLAN_LIMITS / PLAN_LABELS', () => {
  it('define los 4 planes con cupos coherentes y crecientes', () => {
    expect(PLAN_LIMITS.trial.max_vehicles).toBe(5);
    expect(PLAN_LIMITS.starter.max_vehicles).toBe(15);
    expect(PLAN_LIMITS.pro.max_vehicles).toBe(50);
    expect(PLAN_LIMITS.enterprise.max_vehicles).toBe(0); // ilimitado
    expect(PLAN_LABELS.enterprise).toBe('Flotilla');
  });
});

describe('vehicleLimit() / driverLimit()', () => {
  it('usa el cupo explícito de la licencia cuando está definido', () => {
    expect(vehicleLimit({ plan: 'trial', max_vehicles: 12 })).toBe(12);
    expect(driverLimit({ plan: 'pro', max_drivers: 3 })).toBe(3);
  });

  it('cae al default del plan cuando la licencia no trae el cupo', () => {
    expect(vehicleLimit({ plan: 'starter' })).toBe(15);
    expect(driverLimit({ plan: 'pro' })).toBe(75);
  });

  it('trata 0 / null / vacío como ilimitado (Infinity)', () => {
    expect(vehicleLimit({ plan: 'enterprise', max_vehicles: 0 })).toBe(Infinity);
    expect(vehicleLimit({ plan: 'enterprise' })).toBe(Infinity);
    expect(driverLimit({ plan: 'pro', max_drivers: null })).toBe(75); // null → default del plan
    expect(driverLimit({ plan: 'enterprise', max_drivers: '' })).toBe(Infinity);
  });

  it('sin licencia o plan desconocido usa el default de trial', () => {
    expect(vehicleLimit(null)).toBe(5);
    expect(vehicleLimit({ plan: 'inexistente' })).toBe(5);
  });
});

// El fallback por plan que prueban los casos de arriba estuvo MUERTO en producción
// hasta el 2026-09-10: `TenantLicense.jsonc` le daba `"default": 5` a los dos cupos,
// la plataforma lo re-materializaba en cada escritura del registro, y por tanto el
// campo nunca llegaba ausente a `vehicleLimit()`. Todo tenant quedaba clavado en 5
// sin importar su plan, y un `$unset` sobre el registro se deshacía en la siguiente
// escritura. Las pruebas de arriba pasaban igual porque le pasan a la función un
// objeto a mano — verifican la función, no el sistema. Esta lee el esquema de disco.
describe('TenantLicense.jsonc — los cupos NO pueden tener default de esquema', () => {
  const schema = JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'base44/entities/TenantLicense.jsonc'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1'),
  );

  for (const field of ['max_vehicles', 'max_drivers']) {
    it(`${field} no declara "default" (si no, el cupo del plan nunca aplica)`, () => {
      expect(schema.properties?.[field]).toBeTruthy();
      expect(schema.properties[field]).not.toHaveProperty('default');
    });
  }
});

describe('quotaCount() — una baja no ocupa cupo', () => {
  it('cuenta sólo los activos, y trata un registro sin status como activo', () => {
    expect(quotaCount([{ status: 'active' }, { status: 'inactive' }, { status: 'suspended' }, {}])).toBe(2);
    expect(quotaCount([])).toBe(0);
    expect(quotaCount(undefined)).toBe(0);
  });

  it('el caso real que lo destapó: Car-Go Rent cabía en Starter y la app lo bloqueaba', () => {
    // 10 conductores en operación y 16 dados de baja, plan Starter (20 conductores).
    const drivers = [
      ...Array(10).fill({ status: 'active' }),
      ...Array(16).fill({ status: 'inactive' }),
    ];
    const starter = { plan: 'starter' };
    expect(drivers.length).toBe(26); // lo que la app contaba antes
    expect(atDriverLimit(starter, drivers.length)).toBe(true); // → "26 de 20", bloqueado
    expect(quotaCount(drivers)).toBe(10);
    expect(atDriverLimit(starter, quotaCount(drivers))).toBe(false); // dentro de su plan
  });
});

describe('atVehicleLimit() / atDriverLimit()', () => {
  it('bloquea exactamente al alcanzar el cupo', () => {
    const lic = { plan: 'starter' }; // 15 / 20
    expect(atVehicleLimit(lic, 14)).toBe(false);
    expect(atVehicleLimit(lic, 15)).toBe(true);
    expect(atVehicleLimit(lic, 16)).toBe(true);
    expect(atDriverLimit(lic, 19)).toBe(false);
    expect(atDriverLimit(lic, 20)).toBe(true);
  });

  it('nunca bloquea cuando el cupo es ilimitado', () => {
    const lic = { plan: 'enterprise', max_vehicles: 0, max_drivers: 0 };
    expect(atVehicleLimit(lic, 9999)).toBe(false);
    expect(atDriverLimit(lic, 9999)).toBe(false);
  });
});

describe('quotaTone() — la barra avisa antes de que el cupo se acabe', () => {
  // Car-Go Rent: Starter (15) con 10 en operación no debe verse en alerta;
  // 12 de 15 ya sí, para que el dueño vea venir el límite antes del bloqueo.
  it('verde por debajo del 80 %', () => {
    expect(quotaTone(10, 15)).toBe('ok');
  });
  it('ámbar desde el 80 % hasta antes de llenarse', () => {
    expect(quotaTone(12, 15)).toBe('near');
    expect(quotaTone(14, 15)).toBe('near');
  });
  it('rojo al llegar o pasar el límite (el alta ya se bloquea ahí)', () => {
    expect(quotaTone(15, 15)).toBe('full');
    expect(quotaTone(16, 15)).toBe('full');
  });
  it('un límite de 0 se pinta lleno, no verde', () => {
    expect(quotaTone(0, 0)).toBe('full');
  });
  it('un plan ilimitado nunca se pinta lleno', () => {
    expect(quotaTone(500, Infinity)).toBe('ok');
  });
});
