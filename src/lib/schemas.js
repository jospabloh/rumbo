import { z } from 'zod';

/**
 * Centralized zod schemas for the app's entity forms. Keeping them here (rather
 * than inline in each form) makes the validation rules unit-testable and keeps
 * the form components focused on layout. Each schema coerces numeric text inputs
 * to numbers; form components map any leftover `undefined` to the `null`/`0` the
 * backend expects for empty optional fields.
 */

// Optional numeric text field: '' / null / undefined -> undefined, else a
// coerced number with optional min/max bounds. Lets empty inputs stay empty
// instead of coercing to NaN.
const optionalNumber = (min, max) => {
  let num = z.coerce.number({ invalid_type_error: 'Debe ser un número' });
  if (min != null) num = num.min(min, `Mínimo ${min}`);
  if (max != null) num = num.max(max, `Máximo ${max}`);
  return z.preprocess((v) => (v === '' || v == null ? undefined : v), num.optional());
};

const optionalString = z.string().trim().optional().default('');

export const vehicleSchema = z
  .object({
    plate: optionalString,
    unit_number: optionalString,
    make: optionalString,
    model: optionalString,
    year: optionalNumber(1900, 2100),
    vin: optionalString,
    status: z.enum(['active', 'maintenance', 'inactive']),
    assigned_driver_id: optionalString,
    insurance_policy_no: optionalString,
    insurance_expiry: optionalString,
    inspection_expiry: optionalString,
    registration_expiry: optionalString,
    hologram_expiry: optionalString,
    odometer: optionalNumber(0),
    rent_amount: optionalNumber(0),
    rent_frequency: z.enum(['weekly', 'daily']),
    rent_day: optionalString,
    insurance_company: optionalString,
    insurance_annual_cost: optionalNumber(0),
    maintenance_reserve_weekly: optionalNumber(0),
    owner_group_id: optionalString,
  })
  .refine((d) => d.plate?.length || d.unit_number?.length, {
    message: 'Ingresa una placa o un número de unidad',
    path: ['plate'],
  });

export const driverSchema = z.object({
  full_name: z.string().trim().min(1, 'El nombre es obligatorio'),
  referred_by_driver_id: optionalString,
  license_no: optionalString,
  license_expiry: optionalString,
  background_check_date: optionalString,
  hire_date: optionalString,
  phone: optionalString,
  rating: optionalNumber(0, 5),
  status: z.enum(['active', 'suspended', 'inactive']),
  photo_url: optionalString,
  license_file_url: optionalString,
  ine_file_url: optionalString,
  address_proof_file_url: optionalString,
  aval_name: optionalString,
});

export const fineSchema = z.object({
  driver_id: z.string().min(1, 'Selecciona un conductor'),
  vehicle_id: z.string().min(1, 'Selecciona un vehículo'),
  fine_type: optionalString,
  amount: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number({ invalid_type_error: 'Debe ser un número' }).positive('Ingresa un monto válido')
  ),
  points: optionalNumber(0),
  issued_at: optionalString,
  paid: z.boolean().default(false),
  photo_url: optionalString,
});

export const fuelLogSchema = z.object({
  vehicle_id: z.string().min(1, 'Selecciona un vehículo'),
  driver_id: optionalString,
  liters: optionalNumber(0),
  price_per_liter: optionalNumber(0),
  total_cost: optionalNumber(0),
  odometer: optionalNumber(0),
  receipt_photo_url: optionalString,
  logged_at: optionalString,
});

export const insuranceClaimSchema = z.object({
  vehicle_id: z.string().min(1, 'Selecciona un vehículo'),
  driver_id: optionalString,
  description: optionalString,
  claim_amount: optionalNumber(0),
  insurer: optionalString,
  status: z.enum(['open', 'approved', 'denied', 'closed']),
  incident_at: optionalString,
});

export const expenseSchema = z.object({
  category: z.string().trim().min(1, 'Elige una categoría'),
  amount: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number({ invalid_type_error: 'Debe ser un número' }).positive('Ingresa un monto válido')
  ),
  expense_date: optionalString,
  description: optionalString,
  vehicle_id: optionalString,
  payment_method: optionalString,
  notes: optionalString,
});

export const maintenanceSchema = z.object({
  vehicle_id: z.string().min(1, 'Selecciona un vehículo'),
  kind: z.enum(['preventive', 'corrective', 'major_repair']),
  category: z.enum(['general', 'engine', 'brakes', 'electrical', 'tires', 'body', 'other']).optional(),
  description: optionalString,
  odometer: optionalNumber(0),
  cost: optionalNumber(0),
  performed_at: optionalString,
  next_due_at: optionalString,
  photo_url: optionalString,
});

export const channelSchema = z.object({
  name: optionalString,
  kind: z.enum(['broadcast', 'direct']),
  driver_id: optionalString,
});
