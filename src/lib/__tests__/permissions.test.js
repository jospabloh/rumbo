import { describe, it, expect } from 'vitest';
import { can, isAdminOrOwner, isDriver, isOwner, ROLES } from '../permissions.js';

describe('can() — page access by role', () => {
  it('owner can access every page including github, supabase, and billing', () => {
    const pages = ['dashboard', 'drivers', 'vehicles', 'rentas', 'maintenance', 'parts',
      'financial', 'location', 'messages', 'links', 'alerts', 'import',
      'github', 'supabase', 'billing', 'catalogs', 'admin'];
    pages.forEach(page => {
      expect(can(ROLES.OWNER, page), `owner should access ${page}`).toBe(true);
    });
  });

  it('admin can access everything except github and supabase', () => {
    expect(can(ROLES.ADMIN, 'github')).toBe(false);
    expect(can(ROLES.ADMIN, 'supabase')).toBe(false);
    expect(can(ROLES.ADMIN, 'financial')).toBe(true);
    expect(can(ROLES.ADMIN, 'billing')).toBe(true);
    expect(can(ROLES.ADMIN, 'catalogs')).toBe(true);
  });

  it('dispatcher cannot access financial, import, github, supabase, billing, or catalogs', () => {
    const denied = ['financial', 'import', 'github', 'supabase', 'billing', 'catalogs', 'admin'];
    denied.forEach(page => {
      expect(can(ROLES.DISPATCHER, page), `dispatcher should NOT access ${page}`).toBe(false);
    });
  });

  it('dispatcher can access dashboard, drivers, vehicles, location, messages, and alerts', () => {
    const allowed = ['dashboard', 'drivers', 'vehicles', 'location', 'messages', 'alerts'];
    allowed.forEach(page => {
      expect(can(ROLES.DISPATCHER, page), `dispatcher should access ${page}`).toBe(true);
    });
  });

  it('mechanic can access vehicles, maintenance, and parts but not dashboard or financial', () => {
    expect(can(ROLES.MECHANIC, 'vehicles')).toBe(true);
    expect(can(ROLES.MECHANIC, 'maintenance')).toBe(true);
    expect(can(ROLES.MECHANIC, 'parts')).toBe(true);
    expect(can(ROLES.MECHANIC, 'dashboard')).toBe(false);
    expect(can(ROLES.MECHANIC, 'financial')).toBe(false);
    expect(can(ROLES.MECHANIC, 'drivers')).toBe(false);
  });

  it('driver has no access to any back-office page', () => {
    const pages = ['dashboard', 'drivers', 'vehicles', 'rentas', 'maintenance', 'parts',
      'financial', 'location', 'messages', 'alerts', 'import', 'github',
      'supabase', 'billing', 'catalogs', 'admin'];
    pages.forEach(page => {
      expect(can(ROLES.DRIVER, page), `driver should NOT access ${page}`).toBe(false);
    });
  });

  it('returns false for an unknown page regardless of role', () => {
    expect(can(ROLES.OWNER, 'nonexistent_page')).toBe(false);
  });

  it('returns false when role is null or undefined', () => {
    expect(can(null, 'dashboard')).toBe(false);
    expect(can(undefined, 'dashboard')).toBe(false);
  });

  it('returns false when page is null or undefined', () => {
    expect(can(ROLES.OWNER, null)).toBe(false);
    expect(can(ROLES.OWNER, undefined)).toBe(false);
  });
});

describe('isOwner()', () => {
  it('returns true only for the owner role', () => {
    expect(isOwner(ROLES.OWNER)).toBe(true);
  });

  it('returns false for admin (admin is NOT owner)', () => {
    expect(isOwner(ROLES.ADMIN)).toBe(false);
  });

  it('returns false for dispatcher, mechanic, and driver', () => {
    expect(isOwner(ROLES.DISPATCHER)).toBe(false);
    expect(isOwner(ROLES.MECHANIC)).toBe(false);
    expect(isOwner(ROLES.DRIVER)).toBe(false);
  });

  it('returns false for null/undefined input', () => {
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });
});

describe('isAdminOrOwner()', () => {
  it('returns true for owner', () => {
    expect(isAdminOrOwner(ROLES.OWNER)).toBe(true);
  });

  it('returns true for admin', () => {
    expect(isAdminOrOwner(ROLES.ADMIN)).toBe(true);
  });

  it('returns false for dispatcher (dispatcher is NOT admin or owner)', () => {
    expect(isAdminOrOwner(ROLES.DISPATCHER)).toBe(false);
  });

  it('returns false for mechanic and driver', () => {
    expect(isAdminOrOwner(ROLES.MECHANIC)).toBe(false);
    expect(isAdminOrOwner(ROLES.DRIVER)).toBe(false);
  });

  it('returns false for null/undefined input', () => {
    expect(isAdminOrOwner(null)).toBe(false);
    expect(isAdminOrOwner(undefined)).toBe(false);
  });
});

describe('isDriver()', () => {
  it('returns true only for the driver role', () => {
    expect(isDriver(ROLES.DRIVER)).toBe(true);
  });

  it('returns false for all non-driver roles', () => {
    [ROLES.OWNER, ROLES.ADMIN, ROLES.DISPATCHER, ROLES.MECHANIC].forEach(role => {
      expect(isDriver(role), `isDriver should be false for ${role}`).toBe(false);
    });
  });

  it('returns false for null/undefined input', () => {
    expect(isDriver(null)).toBe(false);
    expect(isDriver(undefined)).toBe(false);
  });
});
