import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { TenantProvider, useTenant } from '@/lib/TenantContext';
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
import Landing from './pages/Landing';
import RequireAppOwner from './components/RequireAppOwner';
import ErrorBoundary from './components/ErrorBoundary';
// Add page imports here

const TenantGate = ({ children }) => {
  const { tenantId, isAppOwner, loading, reload } = useTenant();
  const { isLoadingAuth } = useAuth();
  const [user, setUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    import('@/api/base44Client').then(({ base44 }) => {
      base44.auth.me().then(setUser).catch(() => {}).finally(() => setUserLoaded(true));
    });
  }, []);

  // Esperar a tener tenant resuelto Y el perfil del usuario antes de decidir, para no
  // mostrar la app vacía un instante ni parpadear el onboarding.
  if (loading || isLoadingAuth || !userLoaded) return null;

  // Cualquier usuario autenticado que aún no pertenece a un tenant pasa primero por el
  // onboarding: ahí elige crear su organización (prueba de 30 días) o unirse a una
  // existente con un código. El owner de la app es la única excepción: gestiona licencias
  // y puede no tener un tenant propio. Antes solo se atrapaba a admin/owner, así que un
  // usuario nuevo con correo externo caía directo en una app vacía sin guía ni aviso.
  const needsOnboarding = user && !tenantId && !isAppOwner;

  if (needsOnboarding) {
    return <Onboarding user={user} onComplete={() => reload()} />;
  }

  return children;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const [user, setUser] = useState(null);

  useEffect(() => {
    import('@/api/base44Client').then(({ base44 }) => {
      base44.auth.me().then(setUser).catch(() => {});
    });
  }, []);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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
        <Route path="/" element={<Dashboard />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/maintenance" element={<MaintenancePage />} />

        <Route path="/rentas" element={<Rentas />} />
        <Route path="/financial" element={<Financial />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/location" element={<Location />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/import" element={<Import />} />
        <Route path="/driver/home" element={<DriverHome />} />
        <Route path="/driver/profile" element={<DriverProfile />} />
        <Route path="/driver/trips" element={<DriverTrips />} />
        <Route path="/github" element={<RequireAppOwner><GitHubPage /></RequireAppOwner>} />
        <Route path="/supabase" element={<RequireAppOwner><SupabasePage /></RequireAppOwner>} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/catalogs" element={<Catalogs />} />
        <Route path="/links" element={<UsefulLinks />} />
        <Route path="/licenses" element={<RequireAppOwner><Licenses /></RequireAppOwner>} />
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
  )
}

export default App