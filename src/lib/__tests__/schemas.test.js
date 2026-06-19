import { describe, it, expect } from 'vitest';
import {
  vehicleSchema,
  driverSchema,
  fineSchema,
  fuelLogSchema,
  insuranceClaimSchema,
  maintenanceSchema,
  channelSchema,
} from '../schemas';

describe('vehicleSchema', () => {
  it('requires a plate or unit number', () => {
    const r = vehicleSchema.safeParse({ plate: '', unit_number: '', status: 'active', rent_frequency: 'weekly' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].path).toContain('plate');
  });

  it('accepts a unit number with no plate', () => {
    const r = vehicleSchema.safeParse({ plate: '', unit_number: 'U01', status: 'active', rent_frequency: 'weekly' });
    expect(r.success).toBe(true);
  });

  it('coerces numeric text fields and leaves empties undefined', () => {
    const r = vehicleSchema.parse({ plate: 'ABC123', year: '2020', odometer: '', rent_amount: '2800', status: 'active', rent_frequency: 'weekly' });
    expect(r.year).toBe(2020);
    expect(r.odometer).toBeUndefined();
    expect(r.rent_amount).toBe(2800);
  });

  it('rejects an out-of-range year', () => {
    const r = vehicleSchema.safeParse({ plate: 'ABC123', year: '1800', status: 'active', rent_frequency: 'weekly' });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(vehicleSchema.safeParse({ plate: 'A', status: 'flying', rent_frequency: 'weekly' }).success).toBe(false);
  });
});

describe('driverSchema', () => {
  it('requires a full name', () => {
    expect(driverSchema.safeParse({ full_name: '', status: 'active' }).success).toBe(false);
  });

  it('rejects a rating above 5', () => {
    expect(driverSchema.safeParse({ full_name: 'Ana', rating: '6', status: 'active' }).success).toBe(false);
  });

  it('accepts an empty rating', () => {
    const r = driverSchema.parse({ full_name: 'Ana', rating: '', status: 'active' });
    expect(r.rating).toBeUndefined();
  });
});

describe('fineSchema', () => {
  it('requires driver, vehicle and a positive amount', () => {
    expect(fineSchema.safeParse({ driver_id: '', vehicle_id: '', amount: '' }).success).toBe(false);
    expect(fineSchema.safeParse({ driver_id: 'd1', vehicle_id: 'v1', amount: '0' }).success).toBe(false);
  });

  it('accepts a valid fine and coerces amount/points', () => {
    const r = fineSchema.parse({ driver_id: 'd1', vehicle_id: 'v1', amount: '500', points: '3', paid: true });
    expect(r.amount).toBe(500);
    expect(r.points).toBe(3);
    expect(r.paid).toBe(true);
  });
});

describe('fuelLogSchema', () => {
  it('requires a vehicle', () => {
    expect(fuelLogSchema.safeParse({ vehicle_id: '' }).success).toBe(false);
  });

  it('coerces optional numerics', () => {
    const r = fuelLogSchema.parse({ vehicle_id: 'v1', liters: '40.5', total_cost: '900' });
    expect(r.liters).toBe(40.5);
    expect(r.total_cost).toBe(900);
  });
});

describe('insuranceClaimSchema', () => {
  it('requires a vehicle and a valid status', () => {
    expect(insuranceClaimSchema.safeParse({ vehicle_id: '', status: 'open' }).success).toBe(false);
    expect(insuranceClaimSchema.safeParse({ vehicle_id: 'v1', status: 'bogus' }).success).toBe(false);
    expect(insuranceClaimSchema.safeParse({ vehicle_id: 'v1', status: 'approved' }).success).toBe(true);
  });
});

describe('maintenanceSchema', () => {
  it('requires a vehicle and a valid kind', () => {
    expect(maintenanceSchema.safeParse({ vehicle_id: 'v1', kind: 'preventive' }).success).toBe(true);
    expect(maintenanceSchema.safeParse({ vehicle_id: '', kind: 'preventive' }).success).toBe(false);
    expect(maintenanceSchema.safeParse({ vehicle_id: 'v1', kind: 'other' }).success).toBe(false);
  });
});

describe('channelSchema', () => {
  it('validates the channel kind', () => {
    expect(channelSchema.safeParse({ name: '', kind: 'broadcast', driver_id: '' }).success).toBe(true);
    expect(channelSchema.safeParse({ name: '', kind: 'group', driver_id: '' }).success).toBe(false);
  });
});
