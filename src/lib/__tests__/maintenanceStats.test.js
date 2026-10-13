import { describe, it, expect } from 'vitest';
import { maintenanceTimeline, maintenanceByCategory, PERIODS } from '../maintenanceStats';

const now = new Date(2026, 9, 13); // 13-oct-2026

describe('maintenanceTimeline', () => {
  it('agrupa por mes, apila por tipo y separa lo que no tiene costo', () => {
    const records = [
      { performed_at: '2026-10-03', kind: 'preventive', cost: 546 },
      { performed_at: '2026-10-10', kind: 'corrective', cost: null },
      { performed_at: '2026-07-25', kind: 'major_repair', cost: '1400' },
    ];
    const t = maintenanceTimeline(records, 'month', now);
    expect(t).toHaveLength(PERIODS);
    const oct = t.at(-1);
    expect(oct.key).toBe('2026-10-01');
    expect(oct).toMatchObject({ total: 2, preventive: 1, corrective: 1, cost: 546, withoutCost: 1 });
    const jul = t.find((b) => b.key === '2026-07-01');
    expect(jul).toMatchObject({ total: 1, major_repair: 1, cost: 1400 });
  });

  it('agrupa por semana empezando en lunes', () => {
    // 2026-10-12 es lunes; el 11 (domingo) cae en la semana anterior.
    const records = [
      { performed_at: '2026-10-11', kind: 'preventive' },
      { performed_at: '2026-10-12', kind: 'preventive' },
    ];
    const t = maintenanceTimeline(records, 'week', now);
    expect(t.at(-1)).toMatchObject({ key: '2026-10-12', total: 1 });
    expect(t.at(-2)).toMatchObject({ key: '2026-10-05', total: 1 });
  });

  it('extiende el rango hasta un registro con fecha futura en vez de perderlo', () => {
    const t = maintenanceTimeline([{ performed_at: '2026-10-31', kind: 'preventive' }], 'week', now);
    expect(t.at(-1).total).toBe(1);
  });

  it('omite registros sin fecha o fuera del rango', () => {
    const t = maintenanceTimeline([{ performed_at: null }, { performed_at: '2020-01-01' }], 'month', now);
    expect(t.reduce((s, b) => s + b.total, 0)).toBe(0);
  });
});

describe('maintenanceByCategory', () => {
  it('cuenta y suma por categoría, de más a menos servicios', () => {
    const rows = maintenanceByCategory([
      { category: 'tires', cost: null },
      { category: 'engine', cost: 260 },
      { category: 'engine', cost: null },
      { category: 'desconocida', cost: 100 },
    ]);
    expect(rows[0]).toMatchObject({ key: 'engine', label: 'Motor', count: 2, cost: 260 });
    expect(rows.find((r) => r.key === 'general')).toMatchObject({ count: 1, cost: 100 });
    expect(rows.map((r) => r.key)).not.toContain('body');
  });
});

describe('categorías de mantenimiento — una sola lista', () => {
  it('las etiquetas cubren exactamente el enum del esquema', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { CATEGORY_LABELS } = await import('../maintenanceStats');
    const { maintenanceSchema } = await import('../schemas');
    const jsonc = readFileSync(path.resolve(process.cwd(), 'base44/entities/Maintenance.jsonc'), 'utf8');
    const entityEnum = JSON.parse(jsonc).properties.category.enum;
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...entityEnum].sort());
    expect([...maintenanceSchema.shape.category.unwrap().options].sort()).toEqual([...entityEnum].sort());
  });
});
