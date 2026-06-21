import { describe, it, expect } from 'vitest';
import {
  TICKET_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES,
  labelFor, statusColor, validateTicket,
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
