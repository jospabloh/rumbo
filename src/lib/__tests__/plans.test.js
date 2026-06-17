import { describe, it, expect } from 'vitest';
import {
  PLAN_LIMITS,
  PLAN_LABELS,
  vehicleLimit,
  driverLimit,
  atVehicleLimit,
  atDriverLimit,
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
