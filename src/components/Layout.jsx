import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { applyTenantColors } from '@/pages/TenantOnboarding';
import {
  LayoutDashboard, Users, Truck, Wrench, DollarSign,
  MapPin, MessageSquare, Bell, LogOut, Menu, X,
  FileText, CreditCard, Shield, Banknote, List, Link2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { can, isDriver as checkIsDriver } from '@/lib/permissions';
import { SUPPORT_URL } from '@/lib/license';

function LicenseBanner({ info }) {
  if (!info || !info.message || info.state === 'disabled') return null;
  const styles = {
    active: 'bg-warning/10 text-warning border-warning/30',
    past_due: 'bg-warning/10 text-warning border-warning/30',
    readonly: 'bg-destructive/10 text-destructive border-destructive/30',
  };
  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm border-b ${styles[info.state] || styles.active}`}>
      <Bell className="w-4 h-4 shrink-0" />
      <span className="flex-1">{info.message}</span>
      <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="underline shrink-0 text-xs">Renovar</a>
    </div>
  );
}

function LicenseDisabled({ info }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
      <Shield className="w-14 h-14 text-destructive opacity-60" />
      <h2 className="text-lg font-bold">Acceso desactivado</h2>
      <p className="text-sm text-muted-foreground max-w-sm">{info?.message || 'Tu acceso fue desactivado.'}</p>
      <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Contactar a soporte</a>
    </div>
  );
}

const LogoMark = ({ logoUrl, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);
  const sz = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  if (logoUrl && !imgError) {
    return <img src={logoUrl} alt="logo" className={`${sz} rounded-lg object-cover`} onError={() => setImgError(true)} />;
  }
  // Logo oficial de Rumbo (fallback cuando el tenant no tiene logo propio).
  return <img src="/rumbo-logo.svg" alt="Rumbo" className={`${sz} rounded-lg`} />;
};

// Nav items grouped
const NAV_GROUPS = [
  {
    label: null, // sin etiqueta para el grupo principal
    items: [
      { path: '/',        icon: LayoutDashboard, label: 'Dashboard',     page: 'dashboard' },
      { path: '/alerts',  icon: Bell,            label: 'Alertas',       page: 'alerts' },
      { path: '/messages',icon: MessageSquare,   label: 'Mensajes',      page: 'messages' },
      { path: '/location',icon: MapPin,          label: 'Ubicación',     page: 'location' },
      { path: '/links',   icon: Link2,           label: 'Enlaces útiles',page: 'links' },
    ],
  },
  {
    label: 'Catálogos',
    items: [
      { path: '/drivers',     icon: Users,     label: 'Conductores',  page: 'drivers' },
      { path: '/vehicles',    icon: Truck,     label: 'Vehículos',    page: 'vehicles' },
      { path: '/maintenance', icon: Wrench,    label: 'Taller',       page: 'maintenance' },
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

const driverNav = [
  { path: '/driver/home',    icon: LayoutDashboard, label: 'Inicio' },
  { path: '/driver/messages',icon: MessageSquare,   label: 'Mensajes' },
  { path: '/driver/trips',   icon: Truck,           label: 'Viajes' },
  { path: '/driver/profile', icon: Users,           label: 'Perfil' },
];

function NavItem({ path, icon: Icon, label, active, alertCount, unreadCount, onClick }) {
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-sidebar-accent text-primary' : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
      {label === 'Alertas' && alertCount > 0 && (
        <Badge className="ml-auto bg-critical text-white text-xs px-1.5 py-0 h-5">{alertCount}</Badge>
      )}
      {label === 'Mensajes' && unreadCount > 0 && (
        <Badge className="ml-auto bg-primary text-white text-xs px-1.5 py-0 h-5">{unreadCount}</Badge>
      )}
    </Link>
  );
}

export default function Layout() {
  const location = useLocation();
  const { tenant, tenantId, licenseInfo, isAppOwner } = useTenant();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Apply tenant colors when tenant loads
  useEffect(() => {
    if (tenant?.color_primary) {
      applyTenantColors({
        primary: tenant.color_primary,
        secondary: tenant.color_secondary,
        accent: tenant.color_accent,
        background: tenant.color_background,
      });
    }
  }, [tenant]);

  useEffect(() => {
    if (!user || !tenantId) return;
    const role = user.role;
    if (role === 'owner' || role === 'admin' || role === 'dispatcher') {
      base44.entities.Alert.filter({ resolved: false, tenant_id: tenantId }).then(alerts => {
        setAlertCount(alerts.filter(a => a.severity === 'critical').length);
      }).catch(() => {});
      base44.entities.Message.filter({ read: false, tenant_id: tenantId }).then(msgs => {
        setUnreadCount(msgs.length);
      }).catch(() => {});
    }
  }, [user, tenantId]);

  const isDriverRole = checkIsDriver(user?.role);
  const handleLogout = () => base44.auth.logout();

  // Build grouped nav filtered by permissions
  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => can(user?.role, item.page)),
  })).filter(group => group.items.length > 0);

  // El owner de la app ve la sección Licencias (gestión de todas las tenants).
  const navGroups = isAppOwner
    ? [...filteredGroups, { label: 'Plataforma', items: [{ path: '/licenses', icon: Shield, label: 'Licencias', page: 'licenses' }] }]
    : filteredGroups;

  const SidebarContent = ({ onLinkClick }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border shrink-0">
        <LogoMark logoUrl={tenant?.logo_url} />
        <div className="min-w-0">
          <p className="text-sidebar-foreground font-bold text-base tracking-tight leading-tight">Rumbo</p>
          {tenant?.tenant_name && (
            <p className="text-xs text-muted-foreground truncate leading-tight">{tenant.tenant_name}</p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
        {isDriverRole ? (
          driverNav.map(({ path, icon: Icon, label }) => (
            <NavItem key={path} path={path} icon={Icon} label={label}
              active={location.pathname === path} onClick={onLinkClick}
              alertCount={0} unreadCount={0} />
          ))
        ) : (
          navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ path, icon, label, page }) => (
                  <NavItem
                    key={path}
                    path={path}
                    icon={icon}
                    label={label}
                    active={location.pathname === path}
                    onClick={onLinkClick}
                    alertCount={alertCount}
                    unreadCount={unreadCount}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
            {user?.full_name?.charAt(0) || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.full_name || '...'}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role || ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-sidebar-accent w-full transition-all"
        >
          <LogOut className="w-4 h-4" />
          Salir
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background font-inter overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-60 bg-sidebar border-r border-sidebar-border shrink-0">
        <SidebarContent onLinkClick={null} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64 h-full bg-sidebar border-r border-sidebar-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <LogoMark logoUrl={tenant?.logo_url} />
                <p className="text-sidebar-foreground font-bold text-base leading-tight">Rumbo</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col flex-1 overflow-hidden">
              <SidebarContent onLinkClick={() => setSidebarOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <LogoMark logoUrl={tenant?.logo_url} size="sm" />
            <span className="font-bold text-sm">Rumbo</span>
          </div>
          <div className="relative">
            <Link to={isDriverRole ? '/driver/messages' : '/alerts'}>
              <Bell className="w-5 h-5 text-muted-foreground" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-critical rounded-full text-white text-xs flex items-center justify-center">{alertCount}</span>
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <LicenseBanner info={licenseInfo} />
          {licenseInfo?.state === 'disabled' ? <LicenseDisabled info={licenseInfo} /> : <Outlet />}
        </main>

        {/* Mobile bottom nav — driver only */}
        {isDriverRole && (
          <nav className="lg:hidden flex border-t border-border bg-card shrink-0">
            {driverNav.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path;
              return (
                <Link key={path} to={path}
                  className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}