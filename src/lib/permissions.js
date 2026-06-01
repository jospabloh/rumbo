/**
 * Rumbo — Sistema de permisos por rol
 *
 * Roles:
 *  owner      — dueño del tenant: acceso total + licencias/billing
 *  admin      — administrador: acceso total excepto billing
 *  dispatcher — operador: ve dashboard, conductores, vehículos, ubicación, mensajes, alertas
 *  mechanic   — mecánico: mantenimiento e inventario solamente
 *  driver     — conductor: solo vistas /driver/*
 */

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DISPATCHER: 'dispatcher',
  MECHANIC: 'mechanic',
  DRIVER: 'driver',
};

// Páginas/secciones y qué roles tienen acceso
const PAGE_PERMISSIONS = {
  dashboard:   [ROLES.OWNER, ROLES.ADMIN, ROLES.DISPATCHER],
  drivers:     [ROLES.OWNER, ROLES.ADMIN, ROLES.DISPATCHER],
  vehicles:    [ROLES.OWNER, ROLES.ADMIN, ROLES.DISPATCHER, ROLES.MECHANIC],
  maintenance: [ROLES.OWNER, ROLES.ADMIN, ROLES.MECHANIC],
  parts:       [ROLES.OWNER, ROLES.ADMIN, ROLES.MECHANIC],
  financial:   [ROLES.OWNER, ROLES.ADMIN],
  location:    [ROLES.OWNER, ROLES.ADMIN, ROLES.DISPATCHER],
  messages:    [ROLES.OWNER, ROLES.ADMIN, ROLES.DISPATCHER],
  alerts:      [ROLES.OWNER, ROLES.ADMIN, ROLES.DISPATCHER],
  import:      [ROLES.OWNER, ROLES.ADMIN],
  reports:     [ROLES.OWNER, ROLES.ADMIN],
  github:      [ROLES.OWNER, ROLES.ADMIN],
  supabase:    [ROLES.OWNER, ROLES.ADMIN],
  billing:     [ROLES.OWNER, ROLES.ADMIN],
  admin:       [ROLES.OWNER, ROLES.ADMIN],
};

/**
 * Verifica si un rol tiene acceso a una página/sección.
 * @param {string} role  - rol del usuario
 * @param {string} page  - clave de PAGE_PERMISSIONS
 * @returns {boolean}
 */
export function can(role, page) {
  if (!role || !page) return false;
  const allowed = PAGE_PERMISSIONS[page];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Devuelve true si el usuario es admin o owner (gestión plena).
 */
export function isAdminOrOwner(role) {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

/**
 * Devuelve true si el usuario es driver.
 */
export function isDriver(role) {
  return role === ROLES.DRIVER;
}

/**
 * Devuelve true si el usuario es owner.
 */
export function isOwner(role) {
  return role === ROLES.OWNER;
}