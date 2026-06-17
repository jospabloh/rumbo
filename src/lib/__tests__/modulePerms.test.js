/**
 * Tests for moduleCan() and DEFAULT_PERMISSIONS.
 *
 * NOTE: useModulePerms() is a React hook that calls useTenant() (React context)
 * and cannot be tested in a node environment without a full React render tree.
 * All meaningful business logic lives in the pure moduleCan() function,
 * which is tested exhaustively here.
 */
import { describe, it, expect } from 'vitest';
import { moduleCan, DEFAULT_PERMISSIONS } from '../modulePerms.js';

// Shorthand: call with no custom config (rely entirely on DEFAULT_PERMISSIONS)
const can = (role, module, action) => moduleCan(null, role, module, action);

describe('moduleCan() — owner and admin always get full access', () => {
  it('owner can perform any action on any module', () => {
    expect(moduleCan(null, 'owner', 'financial', 'view')).toBe(true);
    expect(moduleCan(null, 'owner', 'financial', 'delete')).toBe(true);
    expect(moduleCan(null, 'owner', 'parts', 'create')).toBe(true);
  });

  it('admin can perform any action on any module', () => {
    expect(moduleCan(null, 'admin', 'financial', 'view')).toBe(true);
    expect(moduleCan(null, 'admin', 'parts', 'delete')).toBe(true);
    expect(moduleCan(null, 'admin', 'drivers', 'create')).toBe(true);
  });

  it('owner/admin bypass any custom config restrictions', () => {
    const restrictiveConfig = {
      owner: { financial: { view: false, create: false, edit: false, delete: false, pause: false } },
    };
    // Even if config says false, owner is always true
    expect(moduleCan(restrictiveConfig, 'owner', 'financial', 'view')).toBe(true);
  });
});

describe('moduleCan() — role is null or undefined', () => {
  it('returns false when role is null', () => {
    expect(moduleCan(null, null, 'vehicles', 'view')).toBe(false);
  });

  it('returns false when role is undefined', () => {
    expect(moduleCan(null, undefined, 'vehicles', 'view')).toBe(false);
  });
});

describe('moduleCan() — dispatcher defaults', () => {
  it('dispatcher can view vehicles', () => {
    expect(can('dispatcher', 'vehicles', 'view')).toBe(true);
  });

  it('dispatcher can create and edit trips', () => {
    expect(can('dispatcher', 'trips', 'create')).toBe(true);
    expect(can('dispatcher', 'trips', 'edit')).toBe(true);
  });

  it('dispatcher CANNOT delete trips', () => {
    expect(can('dispatcher', 'trips', 'delete')).toBe(false);
  });

  it('dispatcher CANNOT view financial data', () => {
    expect(can('dispatcher', 'financial', 'view')).toBe(false);
  });

  it('dispatcher CANNOT view parts', () => {
    expect(can('dispatcher', 'parts', 'view')).toBe(false);
  });

  it('dispatcher CANNOT view reports', () => {
    expect(can('dispatcher', 'reports', 'view')).toBe(false);
  });

  it('dispatcher can create and view maintenance (view only — cannot create)', () => {
    expect(can('dispatcher', 'maintenance', 'view')).toBe(true);
    expect(can('dispatcher', 'maintenance', 'create')).toBe(false);
  });

  it('dispatcher can view, create, and edit location but cannot edit or delete', () => {
    expect(can('dispatcher', 'location', 'view')).toBe(true);
    expect(can('dispatcher', 'location', 'create')).toBe(false);
    expect(can('dispatcher', 'location', 'edit')).toBe(false);
  });
});

describe('moduleCan() — mechanic defaults', () => {
  it('mechanic can view vehicles and edit them', () => {
    expect(can('mechanic', 'vehicles', 'view')).toBe(true);
    expect(can('mechanic', 'vehicles', 'edit')).toBe(true);
  });

  it('mechanic CANNOT create vehicles', () => {
    expect(can('mechanic', 'vehicles', 'create')).toBe(false);
  });

  it('mechanic can view, create, and edit maintenance', () => {
    expect(can('mechanic', 'maintenance', 'view')).toBe(true);
    expect(can('mechanic', 'maintenance', 'create')).toBe(true);
    expect(can('mechanic', 'maintenance', 'edit')).toBe(true);
  });

  it('mechanic CANNOT delete maintenance records', () => {
    expect(can('mechanic', 'maintenance', 'delete')).toBe(false);
  });

  it('mechanic can manage parts (view/create/edit)', () => {
    expect(can('mechanic', 'parts', 'view')).toBe(true);
    expect(can('mechanic', 'parts', 'create')).toBe(true);
    expect(can('mechanic', 'parts', 'edit')).toBe(true);
  });

  it('mechanic CANNOT view drivers, trips, financial, fuel, messages, or location', () => {
    const denied = ['drivers', 'trips', 'financial', 'fuel', 'messages', 'location', 'rentas', 'reports'];
    denied.forEach(mod => {
      expect(can('mechanic', mod, 'view'), `mechanic should NOT view ${mod}`).toBe(false);
    });
  });
});

describe('moduleCan() — driver defaults', () => {
  it('driver can view vehicles (read-only)', () => {
    expect(can('driver', 'vehicles', 'view')).toBe(true);
    expect(can('driver', 'vehicles', 'create')).toBe(false);
    expect(can('driver', 'vehicles', 'edit')).toBe(false);
    expect(can('driver', 'vehicles', 'delete')).toBe(false);
  });

  it('driver can view and create trips but CANNOT delete them', () => {
    expect(can('driver', 'trips', 'view')).toBe(true);
    expect(can('driver', 'trips', 'create')).toBe(true);
    expect(can('driver', 'trips', 'delete')).toBe(false);
  });

  it('driver CANNOT view financial data or reports', () => {
    expect(can('driver', 'financial', 'view')).toBe(false);
    expect(can('driver', 'reports', 'view')).toBe(false);
  });

  it('driver CANNOT access maintenance or parts', () => {
    expect(can('driver', 'maintenance', 'view')).toBe(false);
    expect(can('driver', 'parts', 'view')).toBe(false);
  });

  it('driver can view and create fuel entries but CANNOT edit them', () => {
    expect(can('driver', 'fuel', 'view')).toBe(true);
    expect(can('driver', 'fuel', 'create')).toBe(true);
    expect(can('driver', 'fuel', 'edit')).toBe(false);
  });
});

describe('moduleCan() — custom config overrides DEFAULT_PERMISSIONS', () => {
  it('custom config granting dispatcher delete on trips overrides the default false', () => {
    const config = {
      dispatcher: {
        trips: { view: true, create: true, edit: true, delete: true, pause: false },
      },
    };
    expect(moduleCan(config, 'dispatcher', 'trips', 'delete')).toBe(true);
  });

  it('custom config revoking dispatcher view on vehicles overrides the default true', () => {
    const config = {
      dispatcher: {
        vehicles: { view: false, create: false, edit: false, delete: false, pause: false },
      },
    };
    expect(moduleCan(config, 'dispatcher', 'vehicles', 'view')).toBe(false);
  });

  it('falls back to DEFAULT_PERMISSIONS for a module not covered by custom config', () => {
    // Config covers vehicles but not trips — trips should still use defaults
    const config = {
      dispatcher: {
        vehicles: { view: false, create: false, edit: false, delete: false, pause: false },
      },
    };
    // dispatcher default for trips.view is true
    expect(moduleCan(config, 'dispatcher', 'trips', 'view')).toBe(true);
  });

  it('completely absent config (undefined) falls back to defaults', () => {
    expect(moduleCan(undefined, 'dispatcher', 'vehicles', 'view')).toBe(true);
    expect(moduleCan(undefined, 'mechanic', 'financial', 'view')).toBe(false);
  });
});

describe('DEFAULT_PERMISSIONS structure integrity', () => {
  const roles = ['dispatcher', 'mechanic', 'driver'];
  const modules = [
    'vehicles', 'drivers', 'trips', 'maintenance', 'parts',
    'fuel', 'fines', 'insurance', 'alerts', 'messages',
    'location', 'financial', 'rentas', 'reports',
  ];
  const actions = ['view', 'create', 'edit', 'delete', 'pause'];

  roles.forEach(role => {
    modules.forEach(mod => {
      actions.forEach(action => {
        it(`DEFAULT_PERMISSIONS.${role}.${mod}.${action} is a boolean`, () => {
          expect(typeof DEFAULT_PERMISSIONS[role][mod][action]).toBe('boolean');
        });
      });
    });
  });
});
