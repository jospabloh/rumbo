/**
 * Registro central de navegación de Rumbo.
 *
 * Única fuente de verdad para las secciones de la app y a qué rol pertenecen.
 * Antes esta estructura vivía dentro de `Layout.jsx`; al extraerla, la barra
 * lateral, la paleta de comandos (⌘K) y los guards de ruta comparten exactamente
 * el mismo mapa, así que no se pueden desincronizar (un ítem nuevo aparece en los
 * tres lugares a la vez y respeta los mismos permisos).
 */
import {
  LayoutDashboard, Users, Truck, Wrench, DollarSign,
  MapPin, MessageSquare, Bell, FileText, CreditCard,
  Shield, Banknote, List, Link2, HelpCircle,
} from 'lucide-react';
import { can } from '@/lib/permissions';

/** Grupos de navegación del staff (owner/admin/dispatcher/mechanic). */
export const NAV_GROUPS = [
  {
    label: null, // sin etiqueta para el grupo principal
    items: [
      { path: '/',         icon: LayoutDashboard, label: 'Dashboard',      page: 'dashboard' },
      { path: '/alerts',   icon: Bell,            label: 'Alertas',        page: 'alerts' },
      { path: '/messages', icon: MessageSquare,   label: 'Mensajes',       page: 'messages' },
      { path: '/location', icon: MapPin,          label: 'Ubicación',      page: 'location' },
      { path: '/links',    icon: Link2,           label: 'Enlaces útiles', page: 'links' },
      { path: '/help',     icon: HelpCircle,      label: 'Ayuda',          page: 'help' },
    ],
  },
  {
    label: 'Catálogos',
    items: [
      { path: '/drivers',     icon: Users,  label: 'Conductores', page: 'drivers' },
      { path: '/vehicles',    icon: Truck,  label: 'Vehículos',   page: 'vehicles' },
      { path: '/maintenance', icon: Wrench, label: 'Taller',      page: 'maintenance' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { path: '/rentas',    icon: Banknote,   label: 'Rentas',     page: 'rentas' },
      { path: '/financial', icon: DollarSign, label: 'Financiero', page: 'financial' },
      { path: '/import',    icon: FileText,   label: 'Importar',   page: 'import' },
      { path: '/billing',   icon: CreditCard, label: 'Licencia',   page: 'billing' },
      { path: '/catalogs',  icon: List,       label: 'Catálogos',  page: 'catalogs' },
      { path: '/admin',     icon: Shield,     label: 'Admin',      page: 'admin' },
    ],
  },
];

/** Navegación del conductor (interfaz simplificada /driver/*). */
export const DRIVER_NAV = [
  { path: '/driver/home',     icon: LayoutDashboard, label: 'Inicio' },
  { path: '/driver/messages', icon: MessageSquare,   label: 'Mensajes' },
  { path: '/driver/trips',    icon: Truck,           label: 'Viajes' },
  { path: '/driver/profile',  icon: Users,           label: 'Perfil' },
];

/** Ítem extra del owner de la app (gestión de todas las tenants). */
export const PLATFORM_NAV = { path: '/licenses', icon: Shield, label: 'Licencias', page: 'licenses' };

/**
 * Lista plana de los destinos a los que un rol tiene acceso, ya filtrada por
 * permisos. La usan la paleta de comandos y cualquier buscador de navegación.
 *
 * @param {string} role
 * @param {{ isAppOwner?: boolean }} [opts]
 * @returns {{ path: string, icon: any, label: string, page: string }[]}
 */
export function accessibleNavItems(role, { isAppOwner = false } = {}) {
  const items = NAV_GROUPS.flatMap((g) => g.items).filter((i) => can(role, i.page));
  if (isAppOwner) items.push(PLATFORM_NAV);
  return items;
}

/**
 * ¿El ítem de navegación está activo para la ruta actual? Coincidencia exacta
 * para la raíz `/`; por prefijo para rutas anidadas (p. ej. `/driver` resalta en
 * `/driver/home`). Pura, para resaltar el menú de forma consistente y testeable.
 *
 * @param {string} itemPath
 * @param {string} pathname
 */
export function isNavItemActive(itemPath, pathname) {
  if (itemPath === '/') return pathname === '/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
