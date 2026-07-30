import { describe, it, expect } from 'vitest';
import { accessibleNavItems, NAV_GROUPS, PLATFORM_NAV, isNavItemActive, resolveHomeTarget } from '@/lib/nav';
import { can } from '@/lib/permissions';

describe('accessibleNavItems', () => {
  it('only returns items the role can access', () => {
    for (const role of ['owner', 'admin', 'dispatcher', 'mechanic']) {
      const items = accessibleNavItems(role);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(can(role, item.page)).toBe(true);
      }
    }
  });

  it('never leaks a forbidden section', () => {
    // dispatcher must not see financial/admin/billing/import in quick-nav
    const items = accessibleNavItems('dispatcher').map((i) => i.page);
    expect(items).not.toContain('financial');
    expect(items).not.toContain('admin');
    expect(items).not.toContain('billing');
    expect(items).not.toContain('import');
  });

  it('mechanic only gets its allowed sections', () => {
    const pages = accessibleNavItems('mechanic').map((i) => i.page).sort();
    expect(pages).toEqual(['help', 'links', 'maintenance', 'vehicles']);
  });

  it('appends the platform items only for the app owner', () => {
    const withOwner = accessibleNavItems('owner', { isAppOwner: true });
    for (const item of PLATFORM_NAV) expect(withOwner).toContainEqual(item);
    const without = accessibleNavItems('owner', { isAppOwner: false });
    for (const item of PLATFORM_NAV) expect(without).not.toContainEqual(item);
  });

  it('returns nothing for an unknown role', () => {
    expect(accessibleNavItems('ghost')).toEqual([]);
  });

  it('every nav item declares a path, label and page', () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.path).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.page).toBeTruthy();
      }
    }
  });

  it('exposes Help to every role', () => {
    for (const role of ['owner', 'admin', 'dispatcher', 'mechanic', 'driver', 'investor']) {
      expect(can(role, 'help')).toBe(true);
    }
    // and it shows up in the staff quick-nav
    expect(accessibleNavItems('dispatcher').some((i) => i.page === 'help')).toBe(true);
  });
});

describe('resolveHomeTarget', () => {
  it('sends drivers to their own interface', () => {
    expect(resolveHomeTarget('driver', { hasTenant: true })).toBe('/driver/home');
  });

  it('sends investors to their own interface', () => {
    expect(resolveHomeTarget('investor', { hasTenant: true })).toBe('/investor/home');
  });

  it('shows the dashboard to staff with their own tenant', () => {
    for (const role of ['owner', 'admin', 'dispatcher']) {
      expect(resolveHomeTarget(role, { hasTenant: true })).toBe('dashboard');
    }
  });

  it('regression: an app owner WITH a fleet lands on the dashboard, not /licenses', () => {
    // Antes redirigía a todo app owner a /licenses y el owner-con-flotilla perdía sus tarjetas.
    expect(resolveHomeTarget('admin', { isAppOwner: true, hasTenant: true })).toBe('dashboard');
    expect(resolveHomeTarget('owner', { isAppOwner: true, hasTenant: true })).toBe('dashboard');
  });

  it('sends an app owner WITHOUT a tenant to the licenses console', () => {
    expect(resolveHomeTarget('admin', { isAppOwner: true, hasTenant: false })).toBe('/licenses');
    expect(resolveHomeTarget(null, { isAppOwner: true, hasTenant: false })).toBe('/licenses');
  });

  it('falls back to the first accessible section for staff without dashboard access', () => {
    // mechanic no tiene dashboard: aterriza en su primera sección accesible del menú.
    const first = accessibleNavItems('mechanic')[0];
    expect(resolveHomeTarget('mechanic', { hasTenant: true })).toBe(first.path);
  });

  it('returns null when the role has no sections at all', () => {
    expect(resolveHomeTarget('ghost', { hasTenant: true })).toBeNull();
  });
});

describe('isNavItemActive', () => {
  it('matches the root only exactly', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/', '/vehicles')).toBe(false);
  });

  it('matches nested routes by prefix', () => {
    expect(isNavItemActive('/driver', '/driver/home')).toBe(true);
    expect(isNavItemActive('/vehicles', '/vehicles')).toBe(true);
  });

  it('does not match unrelated or partial-segment routes', () => {
    expect(isNavItemActive('/vehicles', '/drivers')).toBe(false);
    expect(isNavItemActive('/links', '/linksx')).toBe(false);
  });
});
