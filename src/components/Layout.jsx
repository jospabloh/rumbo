import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { applyTenantColors } from '@/lib/palettes';
import { LAST_PATH_KEY, shouldPersist, shouldRestore } from '@/lib/routePersistence';
import {
  LogOut, Menu, X, Bell, Shield, Search, HelpCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { can, isDriver as checkIsDriver, isInvestor as checkIsInvestor } from '@/lib/permissions';
import { SUPPORT_URL } from '@/lib/license';
import { NAV_GROUPS, DRIVER_NAV, INVESTOR_NAV, PLATFORM_NAV, isNavItemActive } from '@/lib/nav';
import { useMe, useAlerts, useMessages } from '@/hooks/useEntities';
import CommandPalette from '@/components/CommandPalette';

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
  return <img src="/rumbo.png" alt="Rumbo" className={`${sz} rounded-lg object-cover`} />;
};

function NavItem({ path, icon: Icon, label, active, alertCount, unreadCount, onClick }) {
  return (
    <Link
      to={path}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
        active
          ? 'bg-primary text-primary-foreground font-bold play-press play-press--primary'
          : 'text-muted-foreground font-semibold hover:text-sidebar-foreground hover:bg-sidebar-accent'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
      {label === 'Alertas' && alertCount > 0 && (
        <Badge className="ml-auto bg-critical text-white text-xs px-1.5 py-0 h-5">{alertCount}</Badge>
      )}
      {label === 'Mensajes' && unreadCount > 0 && (
        <Badge className={`ml-auto text-xs px-1.5 py-0 h-5 ${active ? 'bg-primary-foreground text-primary hover:bg-primary-foreground' : 'bg-primary text-primary-foreground hover:bg-primary'}`}>{unreadCount}</Badge>
      )}
    </Link>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, tenantId, licenseInfo, isAppOwner } = useTenant();
  const { data: user } = useMe();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const restoredRef = useRef(false);

  // Permanencia: recuerda la última sección y, al recargar (aterrizando en la
  // raíz), restaura esa sección en vez de resetear al inicio.
  useEffect(() => {
    if (shouldPersist(location.pathname)) {
      try { localStorage.setItem(LAST_PATH_KEY, location.pathname); } catch { /* almacenamiento no disponible */ }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    let saved = null;
    try { saved = localStorage.getItem(LAST_PATH_KEY); } catch { /* almacenamiento no disponible */ }
    if (shouldRestore(location.pathname, saved)) navigate(saved, { replace: true });
    // Solo en el primer montaje: no debe rebotar cuando el usuario va al inicio a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Contadores de la barra lateral sobre la misma capa de datos cacheada que el
  // dashboard (mismo queryKey ⇒ una sola petición compartida), en vez del fetch
  // manual con useEffect que se repetía en cada montaje.
  const staff = ['owner', 'admin', 'dispatcher'].includes(user?.role);
  const countsEnabled = staff && !!tenantId;
  const { data: openAlerts = [] } = useAlerts({ filter: { resolved: false }, enabled: countsEnabled });
  const { data: unreadMsgs = [] } = useMessages({ filter: { read: false }, enabled: countsEnabled });
  const alertCount = openAlerts.filter(a => a.severity === 'critical').length;
  const unreadCount = unreadMsgs.length;

  const isDriverRole = checkIsDriver(user?.role);
  const isInvestorRole = checkIsInvestor(user?.role);
  // Conductor y socio comparten la interfaz simplificada de sidebar/nav inferior
  // (sin paleta de comandos ni contadores de staff), cada uno con su propia lista de nav.
  const isSimplifiedRole = isDriverRole || isInvestorRole;
  const simplifiedNav = isDriverRole ? DRIVER_NAV : INVESTOR_NAV;
  const handleLogout = () => base44.auth.logout();

  // Conductor y socio llevan una barra de navegación inferior (<1024px): le avisa
  // al CSS para subir el selector de tema por encima de ella (src/index.css).
  useEffect(() => {
    const root = document.documentElement;
    if (isSimplifiedRole) root.setAttribute('data-bottom-nav', '');
    else root.removeAttribute('data-bottom-nav');
    return () => root.removeAttribute('data-bottom-nav');
  }, [isSimplifiedRole]);

  // Build grouped nav filtered by permissions
  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => can(user?.role, item.page)),
  })).filter(group => group.items.length > 0);

  // El owner de la app ve la sección Licencias (gestión de todas las tenants).
  const navGroups = isAppOwner
    ? [...filteredGroups, { label: 'Plataforma', items: PLATFORM_NAV }]
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
        {isSimplifiedRole ? (
          simplifiedNav.map(({ path, icon: Icon, label }) => (
            <NavItem key={path} path={path} icon={Icon} label={label}
              active={isNavItemActive(path, location.pathname)} onClick={onLinkClick}
              alertCount={0} unreadCount={0} />
          ))
        ) : (
          <>
          <button
            onClick={() => { onLinkClick?.(); setCmdOpen(true); }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent transition-all"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span>Buscar…</span>
            <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border border-sidebar-border bg-sidebar text-muted-foreground">⌘K</kbd>
          </button>
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ path, icon, label }) => (
                  <NavItem
                    key={path}
                    path={path}
                    icon={icon}
                    label={label}
                    active={isNavItemActive(path, location.pathname)}
                    onClick={onLinkClick}
                    alertCount={alertCount}
                    unreadCount={unreadCount}
                  />
                ))}
              </div>
            </div>
          ))}
          </>
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
        <Link
          to="/help"
          onClick={onLinkClick}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-all"
        >
          <HelpCircle className="w-4 h-4" />
          Ayuda y soporte
        </Link>
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
    <div className="flex h-screen bg-background font-body overflow-hidden">
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
          {!isInvestorRole && (
            <div className="relative">
              <Link to={isDriverRole ? '/driver/messages' : '/alerts'}>
                <Bell className="w-5 h-5 text-muted-foreground" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-critical rounded-full text-white text-xs flex items-center justify-center">{alertCount}</span>
                )}
              </Link>
            </div>
          )}
        </header>

        {/* pb-14: deja libre la esquina del selector de tema para que el último control de la página no quede debajo. */}
        <main className="flex-1 overflow-y-auto pb-14">
          <LicenseBanner info={licenseInfo} />
          {licenseInfo?.state === 'disabled' ? <LicenseDisabled info={licenseInfo} /> : <Outlet />}
        </main>

        {/* Mobile bottom nav — driver/investor simplified roles only */}
        {isSimplifiedRole && (
          <nav className="lg:hidden flex border-t border-border bg-card shrink-0">
            {simplifiedNav.map(({ path, icon: Icon, label }) => {
              const active = isNavItemActive(path, location.pathname);
              return (
                <Link key={path} to={path}
                  className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${active ? 'text-primary font-bold' : 'text-muted-foreground font-semibold'}`}>
                  <span className={`px-3 rounded-full transition-colors ${active ? 'bg-primary/15' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Paleta de comandos (⌘K) — solo staff */}
      {!isSimplifiedRole && (
        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} role={user?.role} isAppOwner={isAppOwner} />
      )}
    </div>
  );
}