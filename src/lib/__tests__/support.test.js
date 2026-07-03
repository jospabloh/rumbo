import { describe, it, expect } from 'vitest';
import {
  TICKET_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES,
  labelFor, statusColor, validateTicket, suggestSolution, SUPPORT_SLA_HOURS,
} from '@/lib/support';

describe('support catalogs', () => {
  it('expose value/label pairs', () => {
    for (const list of [TICKET_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES]) {
      expect(list.length).toBeGreaterThan(0);
      for (const o of list) { expect(o.value).toBeTruthy(); expect(o.label).toBeTruthy(); }
    }
  });
});

describe('labelFor', () => {
  it('returns the label for a known value', () => {
    expect(labelFor(TICKET_STATUSES, 'open')).toBe('Abierto');
    expect(labelFor(TICKET_CATEGORIES, 'bug')).toBe('Problema / error');
  });
  it('falls back to the raw value, then the fallback', () => {
    expect(labelFor(TICKET_STATUSES, 'weird')).toBe('weird');
    expect(labelFor(TICKET_STATUSES, '')).toBe('—');
    expect(labelFor(TICKET_STATUSES, null, 'n/a')).toBe('n/a');
  });
});

describe('statusColor', () => {
  it('maps statuses to theme colors', () => {
    expect(statusColor('open')).toBe('warning');
    expect(statusColor('resolved')).toBe('success');
    expect(statusColor('unknown')).toBe('muted');
  });
});

describe('validateTicket', () => {
  it('passes a well-formed ticket', () => {
    expect(validateTicket({ subject: 'No carga', body: 'No puedo registrar un cobro hoy.' })).toBeNull();
  });
  it('requires a subject', () => {
    expect(validateTicket({ subject: '', body: 'detalle suficiente aquí' })).toMatch(/asunto/i);
  });
  it('rejects a too-short subject', () => {
    expect(validateTicket({ subject: 'ab', body: 'detalle suficiente aquí' })).toMatch(/corto/i);
  });
  it('requires a body with enough detail', () => {
    expect(validateTicket({ subject: 'Asunto válido', body: '' })).toMatch(/describe/i);
    expect(validateTicket({ subject: 'Asunto válido', body: 'corto' })).toMatch(/detalle/i);
  });
});

describe('suggestSolution', () => {
  it('matches by keyword over category', () => {
    expect(suggestSolution('question', 'no puedo registrar un cobro de renta').section).toBe('Rentas');
    expect(suggestSolution('question', 'problema con un permiso de rol').section).toBe('Admin y permisos');
    expect(suggestSolution('question', 'el stock de una refacción').section).toBe('Taller');
    expect(suggestSolution('question', 'error al importar csv').section).toBe('Importar');
  });

  it('matches login/account phrasing before generic permissions', () => {
    expect(suggestSolution('question', 'no puedo entrar a la app').section).toBe('Acceso y cuenta');
    expect(suggestSolution('other', 'olvidé mi contraseña').section).toBe('Acceso y cuenta');
    expect(suggestSolution('question', 'problema al iniciar sesión').section).toBe('Acceso y cuenta');
  });

  it('falls back to the category when no keyword matches', () => {
    expect(suggestSolution('billing', 'asdfqwer').section).toBe('Licencia');
    expect(suggestSolution('feature', 'xyz').section).toBe('Guía por módulo');
  });

  it('gives an actionable, non-empty tip on the generic fallback', () => {
    const { tip } = suggestSolution('other', 'zzz sin coincidencia');
    expect(tip.length).toBeGreaterThan(20);
    expect(tip).toMatch(/escál|48 h/i); // guides the user to escalate rather than a dead end
  });

  it('falls back to a generic section for unknown category and text', () => {
    expect(suggestSolution('zzz', '').section).toBe('Guía por módulo');
  });

  it('always returns a tip string', () => {
    expect(typeof suggestSolution('question', 'vehículo placa').tip).toBe('string');
  });
});

describe('SUPPORT_SLA_HOURS', () => {
  it('is 48 business hours', () => {
    expect(SUPPORT_SLA_HOURS).toBe(48);
  });
});
