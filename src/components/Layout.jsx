import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Users, Truck, Wrench, DollarSign,
  MapPin, MessageSquare, Bell, LogOut, Menu, X,
  AlertTriangle, Package, FileText, CreditCard
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { can, isDriver as checkIsDriver } from '@/lib/permissions';

const LogoMark = ({ logoUrl, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);
  const sz = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  if (logoUrl && !imgError) {
    return <img src={logoUrl} alt="logo" className={`${sz} rounded-lg object-cover`} onError={() => setImgError(true)} />;
  }
  return (
    <div className={`${sz} bg-primary rounded-lg flex items-center justify-center`}>
      <span className={`text-white font-bold ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>R</span>
    </div>
  );
};

// page key must match keys in permissions.js PAGE_PERMISSIONS
const allAdminNav = [
  { path: '/',            icon: LayoutDashboard, label: 'Dashboard',   page: 'dashboard' },
  { path: '/drivers',     icon: Users,           label: 'Conductores', page: 'drivers' },
  { path: '/vehicles',    icon: Truck,           label: 'Vehículos',   page: 'vehicles' },
  { path: '/maintenance', icon: Wrench,          label: 'Mantenimiento', page: 'maintenance' },
  { path: '/parts',       icon: Package,         label: 'Inventario',  page: 'parts' },
  { path: '/financial',   icon: DollarSign,      label: 'Financiero',  page: 'financial' },
  { path: '/location',    icon: MapPin,          label: 'Ubicación',   page: 'location' },
  { path: '/messages',    icon: MessageSquare,   label: 'Mensajes',    page: 'messages' },
  { path: '/alerts',      icon: Bell,            label: 'Alertas',     page: 'alerts' },
  { path: '/import',      icon: FileText,        label: 'Importar',    page: 'import' },
  { path: '/billing',     icon: CreditCard,      label: 'Licencia',    page: 'billing' },
];

const driverNav = [
  { path: '/driver/home',     icon: LayoutDashboard, label: 'Inicio' },
  { path: '/driver/messages', icon: MessageSquare,   label: 'Mensajes' },
  { path: '/driver/trips',    icon: Truck,           label: 'Viajes' },
  { path: '/driver/profile',  icon: Users,           label: 'Perfil' },
];

export default function Layout() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.TenantLicense.list('-created_date', 1).then(list => setTenant(list[0] || null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const role = user.role;
    if (role === 'owner' || role === 'admin' || role === 'dispatcher') {
      base44.entities.Alert.filter({ resolved: false }).then(alerts => {
        setAlertCount(alerts.filter(a => a.severity === 'critical').length);
      }).catch(() => {});
      base44.entities.Message.filter({ read: false }).then(msgs => {
        setUnreadCount(msgs.length);
      }).catch(() => {});
    }
  }, [user]);

  const isDriver = checkIsDriver(user?.role);
  const nav = isDriver
    ? driverNav
    : allAdminNav.filter(item => can(user?.role, item.page));

  const handleLogout = () => base44.auth.logout();

  return (
    <div className="flex h-screen bg-background font-inter overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-60 bg-sidebar border-r border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
          <LogoMark logoUrl={tenant?.logo_url} />
          <div className="min-w-0">
            <p className="text-sidebar-foreground font-bold text-base tracking-tight leading-tight">Rumbo</p>
            {tenant?.tenant_name && (
              <p className="text-xs text-muted-foreground truncate leading-tight">{tenant.tenant_name}</p>
            )}
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-sidebar-accent text-primary'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
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
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
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
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64 h-full bg-sidebar border-r border-sidebar-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <LogoMark logoUrl={tenant?.logo_url} />
                <div className="min-w-0">
                  <p className="text-sidebar-foreground font-bold text-base leading-tight">Rumbo</p>
                  {tenant?.tenant_name && (
                    <p className="text-xs text-muted-foreground truncate leading-tight">{tenant.tenant_name}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
              {nav.map(({ path, icon: Icon, label }) => {
                const active = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      active ? 'bg-sidebar-accent text-primary' : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {label === 'Alertas' && alertCount > 0 && (
                      <Badge className="ml-auto bg-critical text-white text-xs px-1.5 py-0 h-5">{alertCount}</Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="px-3 py-4 border-t border-sidebar-border">
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive w-full">
                <LogOut className="w-4 h-4" />Salir
              </button>
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
            <div>
              <span className="font-bold text-sm">Rumbo</span>
              {tenant?.tenant_name && <span className="text-xs text-muted-foreground ml-1.5">{tenant.tenant_name}</span>}
            </div>
          </div>
          <div className="relative">
            <Link to={isDriver ? '/driver/messages' : '/alerts'}>
              <Bell className="w-5 h-5 text-muted-foreground" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-critical rounded-full text-white text-xs flex items-center justify-center">{alertCount}</span>
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav — driver only */}
        {isDriver && (
          <nav className="lg:hidden flex border-t border-border bg-card shrink-0">
            {driverNav.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
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