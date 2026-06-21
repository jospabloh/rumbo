import { ThemeProvider } from 'next-themes';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { TenantProvider, useTenant } from '@/lib/TenantContext';
import { useMe } from '@/hooks/useEntities';
import { can, isDriver } from '@/lib/permissions';
import { accessibleNavItems } from '@/lib/nav';
import Onboarding from './pages/Onboarding';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Drivers from './pages/Drivers';
import Vehicles from './pages/Vehicles';
import MaintenancePage from './pages/MaintenancePage';
import Financial from './pages/Financial';
import Rentas from './pages/Rentas';
import Alerts from './pages/Alerts';
import Location from './pages/Location';
import Messages from './pages/Messages';
import Import from './pages/Import';
import DriverHome from './pages/driver/DriverHome';
import DriverProfile from './pages/driver/DriverProfile';
import DriverTrips from './pages/driver/DriverTrips';
import GitHubPage from './pages/GitHubPage';
import SupabasePage from './pages/SupabasePage';
import Billing from './pages/Billing';
import Admin from './pages/Admin';
import Licenses from './pages/Licenses';
import Catalogs from './pages/Catalogs';
import UsefulLinks from './pages/UsefulLinks';
import TestData from './pages/TestData';
import Tickets from './pages/Tickets';
import Help from './pages/Help';
import Landing from './pages/Landing';
import RequireAppOwner from './components/RequireAppOwner';
import RequireAccess from './components/RequireAccess';
import ErrorBoundary from './components/ErrorBoundary';
import { PageLoader, Spinner } from '@/components/ui/spinner';
// Add page imports here

const TenantGate = ({ children }) => {
  const { tenantId, isAppOwner, loading, reload } = useTenant();
  const { isLoadingAuth } = useAuth();
  const { data: user, isLoading: userLoading, isFetched: userFetched } = useMe();

  // Esperar a tener tenant resuelto Y el perfil del usuario antes de decidir, para no
  // mostrar la app vacía un instante ni parpadear el onboarding.
  if (loading || isLoadingAuth || (userLoading && !userFetched)) return null;

  // Cualquier usuario autenticado que aún no pertenece a un tenant pasa primero por el
  // onboarding: ahí elige crear su organización (prueba de 30 días) o unirse a una
  // existente con un código. El owner de la app es la única excepción: gestiona licencias
  // y puede no tener un tenant propio.
  const needsOnboarding = user && !tenantId && !isAppOwner;

  if (needsOnboarding) {
    return <Onboarding user={user} onComplete={() => reload()} />;
  }

  return children;
};

/**
 * Home — destino de la ruta raíz según el rol. El dashboard no es accesible para
 * todos (un mecánico, por ejemplo, no lo ve), así que en lugar de mostrar una
 * pantalla de "acceso restringido" en `/`, redirige a la primera sección a la que
 * el rol sí tiene acceso. El conductor va a su propia interfaz.
 */
const Home = () => {
  const { userRole, loading } = useTenant();
  if (loading) return <PageLoader />;
  if (isDriver(userRole)) return <Navigate to="/driver/home" replace />;
  if (can(userRole, 'dashboard')) return <Dashboard />;
  const items = accessibleNavItems(userRole);
  if (items.length > 0) return <Navigate to={items[0].path} replace />;
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6 text-center">
      <p className="text-sm text-muted-foreground">Tu cuenta no tiene secciones asignadas. Contacta al administrador.</p>
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <TenantGate>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/drivers" element={<RequireAccess page="drivers"><Drivers /></RequireAccess>} />
        <Route path="/vehicles" element={<RequireAccess page="vehicles"><Vehicles /></RequireAccess>} />
        <Route path="/maintenance" element={<RequireAccess page="maintenance"><MaintenancePage /></RequireAccess>} />
        <Route path="/rentas" element={<RequireAccess page="rentas"><Rentas /></RequireAccess>} />
        <Route path="/financial" element={<RequireAccess page="financial"><Financial /></RequireAccess>} />
        <Route path="/alerts" element={<RequireAccess page="alerts"><Alerts /></RequireAccess>} />
        <Route path="/location" element={<RequireAccess page="location"><Location /></RequireAccess>} />
        <Route path="/messages" element={<RequireAccess page="messages"><Messages /></RequireAccess>} />
        <Route path="/links" element={<RequireAccess page="links"><UsefulLinks /></RequireAccess>} />
        <Route path="/help" element={<RequireAccess page="help"><Help /></RequireAccess>} />
        <Route path="/import" element={<RequireAccess page="import"><Import /></RequireAccess>} />
        <Route path="/driver/home" element={<RequireAccess roles={['driver']}><DriverHome /></RequireAccess>} />
        <Route path="/driver/profile" element={<RequireAccess roles={['driver']}><DriverProfile /></RequireAccess>} />
        <Route path="/driver/trips" element={<RequireAccess roles={['driver']}><DriverTrips /></RequireAccess>} />
        <Route path="/driver/messages" element={<RequireAccess roles={['driver']}><Messages /></RequireAccess>} />
        <Route path="/github" element={<RequireAppOwner><GitHubPage /></RequireAppOwner>} />
        <Route path="/supabase" element={<RequireAppOwner><SupabasePage /></RequireAppOwner>} />
        <Route path="/billing" element={<RequireAccess page="billing"><Billing /></RequireAccess>} />
        <Route path="/admin" element={<RequireAccess page="admin"><Admin /></RequireAccess>} />
        <Route path="/catalogs" element={<RequireAccess page="catalogs"><Catalogs /></RequireAccess>} />
        <Route path="/licenses" element={<RequireAppOwner><Licenses /></RequireAppOwner>} />
        <Route path="/tickets" element={<RequireAppOwner><Tickets /></RequireAppOwner>} />
        <Route path="/test-data" element={<RequireAppOwner><TestData /></RequireAppOwner>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </TenantGate>
  );
};


/**
 * AppShell — decides between the public marketing landing and the
 * authenticated app. The landing must render WITHOUT going through the
 * auth gate (which redirects unauthenticated visitors to login), so we
 * short-circuit it here based on the URL.
 */
const AppShell = () => {
  const location = useLocation();
  if (/^\/landing\/?$/i.test(location.pathname)) {
    return <Landing />;
  }
  return <AuthenticatedApp />;
};

function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="rumbo-theme" disableTransitionOnChange>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <TenantProvider>
              <ErrorBoundary>
                <AppShell />
              </ErrorBoundary>
            </TenantProvider>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
