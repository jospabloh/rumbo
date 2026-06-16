import { useTenant } from '@/lib/TenantContext';

/**
 * Permisos granulares por rol/módulo/acción.
 * - owner/admin: acceso total (no configurable).
 * - dispatcher/mechanic/driver: lo que el admin definió en TenantLicense.permissions_config,
 *   con estos defaults como respaldo.
 *
 * Nota: el backstop duro sigue siendo el RLS por rol de cada entidad. Esta capa refina la UI
 * según la configuración del tenant (no puede ser más permisiva que el RLS).
 */
export const DEFAULT_PERMISSIONS = {
  dispatcher: {
    vehicles:    { view: true,  create: true,  edit: true,  delete: false, pause: false },
    drivers:     { view: true,  create: true,  edit: true,  delete: false, pause: true  },
    trips:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    maintenance: { view: true,  create: false, edit: false, delete: false, pause: false },
    parts:       { view: false, create: false, edit: false, delete: false, pause: false },
    fuel:        { view: true,  create: true,  edit: true,  delete: false, pause: false },
    fines:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    insurance:   { view: true,  create: true,  edit: true,  delete: false, pause: false },
    alerts:      { view: true,  create: true,  edit: true,  delete: false, pause: false },
    messages:    { view: true,  create: true,  edit: true,  delete: false, pause: false },
    location:    { view: true,  create: false, edit: false, delete: false, pause: false },
    financial:   { view: false, create: false, edit: false, delete: false, pause: false },
    rentas:      { view: true,  create: true,  edit: true,  delete: false, pause: false },
    reports:     { view: false, create: false, edit: false, delete: false, pause: false },
  },
  mechanic: {
    vehicles:    { view: true,  create: false, edit: true,  delete: false, pause: true  },
    drivers:     { view: false, create: false, edit: false, delete: false, pause: false },
    trips:       { view: false, create: false, edit: false, delete: false, pause: false },
    maintenance: { view: true,  create: true,  edit: true,  delete: false, pause: false },
    parts:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    fuel:        { view: false, create: false, edit: false, delete: false, pause: false },
    fines:       { view: false, create: false, edit: false, delete: false, pause: false },
    insurance:   { view: false, create: false, edit: false, delete: false, pause: false },
    alerts:      { view: false, create: false, edit: false, delete: false, pause: false },
    messages:    { view: false, create: false, edit: false, delete: false, pause: false },
    location:    { view: false, create: false, edit: false, delete: false, pause: false },
    financial:   { view: false, create: false, edit: false, delete: false, pause: false },
    rentas:      { view: false, create: false, edit: false, delete: false, pause: false },
    reports:     { view: false, create: false, edit: false, delete: false, pause: false },
  },
  driver: {
    vehicles:    { view: true,  create: false, edit: false, delete: false, pause: false },
    drivers:     { view: true,  create: false, edit: true,  delete: false, pause: false },
    trips:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    maintenance: { view: false, create: false, edit: false, delete: false, pause: false },
    parts:       { view: false, create: false, edit: false, delete: false, pause: false },
    fuel:        { view: true,  create: true,  edit: false, delete: false, pause: false },
    fines:       { view: true,  create: false, edit: false, delete: false, pause: false },
    insurance:   { view: true,  create: false, edit: false, delete: false, pause: false },
    alerts:      { view: true,  create: false, edit: false, delete: false, pause: false },
    messages:    { view: true,  create: true,  edit: false, delete: false, pause: false },
    location:    { view: false, create: false, edit: false, delete: false, pause: false },
    financial:   { view: false, create: false, edit: false, delete: false, pause: false },
    rentas:      { view: false, create: false, edit: false, delete: false, pause: false },
    reports:     { view: false, create: false, edit: false, delete: false, pause: false },
  },
};

export function moduleCan(config, role, module, action) {
  if (!role) return false;
  if (role === 'owner' || role === 'admin') return true;
  const fromConfig = config?.[role]?.[module]?.[action];
  if (typeof fromConfig === 'boolean') return fromConfig;
  return !!DEFAULT_PERMISSIONS[role]?.[module]?.[action];
}

/**
 * Hook: devuelve can(module, action) según el rol del usuario y la config del tenant.
 */
export function useModulePerms() {
  const { tenant, userRole } = useTenant();
  const config = tenant?.permissions_config;
  return {
    role: userRole,
    can: (module, action) => moduleCan(config, userRole, module, action),
  };
}
