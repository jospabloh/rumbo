import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ASSIGNABLE_ROLES, normalizeJoinRequest } from '../joinRequests.js';

const read = (p) => readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');

describe('ASSIGNABLE_ROLES', () => {
  it('nunca incluye owner (la propiedad va por delegateOwnership)', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('owner');
  });

  it('coincide con la lista blanca del servidor (manageMember) y con manageRole menos owner', () => {
    const fn = read('base44/functions/manageMember/entry.ts');
    const m = fn.match(/const ASSIGNABLE_ROLES = \[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const server = m[1].split(',').map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean);
    expect(server).toEqual(ASSIGNABLE_ROLES);

    const roleFn = read('base44/functions/manageRole/entry.ts');
    const v = roleFn.match(/const VALID_ROLES = \[([^\]]*)\]/)[1]
      .split(',').map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean);
    expect(v.filter((r) => r !== 'owner')).toEqual(ASSIGNABLE_ROLES);
  });
});

describe('normalizeJoinRequest', () => {
  it('acepta pending y rejected, descarta lo demás', () => {
    expect(normalizeJoinRequest({ id: '1', status: 'pending', tenant_name: 'Acme' })).toEqual({
      id: '1', status: 'pending', tenantName: 'Acme', requestedAt: null,
    });
    expect(normalizeJoinRequest({ status: 'rejected' })?.tenantName).toBe('la organización');
    expect(normalizeJoinRequest({ status: 'approved' })).toBeNull();
    expect(normalizeJoinRequest(null)).toBeNull();
  });
});

describe('guardias de contrato (texto de las funciones)', () => {
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('joinTenant nunca escribe members[] ni el perfil: solo crea la solicitud', () => {
    const src = stripComments(read('base44/functions/joinTenant/entry.ts'));
    expect(src).not.toMatch(/TenantLicense\.update/);
    expect(src).not.toMatch(/User\.update/);
    expect(src).toMatch(/JoinRequest\.create/);
  });

  it('JoinRequest es service-role-only en las cuatro operaciones', () => {
    const raw = read('base44/entities/JoinRequest.jsonc');
    const rls = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '')).rls;
    for (const op of ['create', 'read', 'update', 'delete']) {
      expect(rls[op]).toEqual({ user_condition: { role: '__service_role_only__' } });
    }
  });

  it('createTenant rechaza (409) a quien ya tiene tenant o solicitud pendiente', () => {
    const src = stripComments(read('base44/functions/createTenant/entry.ts'));
    expect(src).toMatch(/status: 409/);
    expect(src).toMatch(/JoinRequest\.filter/);
  });

  it('el rol de aprobación se valida contra la lista blanca antes de escribir', () => {
    const src = read('base44/functions/manageMember/entry.ts');
    const validate = src.indexOf('ASSIGNABLE_ROLES.includes(role)');
    const write = src.indexOf('TenantLicense.update(tenantId, { members: nextMembers })');
    expect(validate).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(validate);
  });
});
