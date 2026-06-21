import { describe, it, expect } from 'vitest';
import { MANUAL_SECTIONS } from '@/lib/manual';
import { suggestSolution } from '@/lib/support';

describe('MANUAL_SECTIONS', () => {
  it('covers the main modules', () => {
    expect(MANUAL_SECTIONS.length).toBeGreaterThanOrEqual(15);
  });

  it('every section has id, title, icon and at least one topic', () => {
    for (const s of MANUAL_SECTIONS) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(Array.isArray(s.topics) && s.topics.length > 0).toBe(true);
    }
  });

  it('every topic has a title and concrete steps', () => {
    for (const s of MANUAL_SECTIONS) {
      for (const t of s.topics) {
        expect(t.title).toBeTruthy();
        expect(Array.isArray(t.steps) && t.steps.length > 0).toBe(true);
        for (const step of t.steps) expect(typeof step).toBe('string');
      }
    }
  });

  it('section ids are unique', () => {
    const ids = MANUAL_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sections referred to by the support suggester exist in the manual', () => {
    // The support flow points users to a manual section title; make sure the
    // titles it can produce are actually present so the reference is never dead.
    const titles = new Set(MANUAL_SECTIONS.map((s) => s.title));
    const probes = [
      ['question', 'cobro de renta'],          // Rentas
      ['question', 'permiso de rol'],           // Admin y permisos
      ['billing', ''],                          // Licencia
      ['question', 'stock de refacción'],       // Taller
      ['question', 'placa del vehículo'],       // Vehículos
      ['question', 'importar csv'],             // Importar
      ['question', 'tema oscuro'],              // Interfaz y apariencia
    ];
    for (const [cat, text] of probes) {
      const { section } = suggestSolution(cat, text);
      if (section !== 'Guía por módulo') {
        expect(titles.has(section)).toBe(true);
      }
    }
  });
});
