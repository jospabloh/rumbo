import { describe, it, expect } from 'vitest';
import { accessibleNavItems, NAV_GROUPS, PLATFORM_NAV } from '@/lib/nav';
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
    expect(pages).toEqual(['links', 'maintenance', 'vehicles']);
  });

  it('appends the platform (licenses) item only for the app owner', () => {
    const withOwner = accessibleNavItems('owner', { isAppOwner: true });
    expect(withOwner).toContainEqual(PLATFORM_NAV);
    const without = accessibleNavItems('owner', { isAppOwner: false });
    expect(without).not.toContainEqual(PLATFORM_NAV);
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
});
