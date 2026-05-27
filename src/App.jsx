import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { TenantProvider, useTenant } from '@/lib/TenantContext';
import TenantOnboarding from './pages/TenantOnboarding';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Drivers from './pages/Drivers';
import Vehicles from './pages/Vehicles';
import MaintenancePage from './pages/MaintenancePage';
import Financial from './pages/Financial';
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
import TestData from './pages/TestData';
// Add page imports here

const TenantGate = ({ children }) => {
  const { tenant, tenantId, loading } = useTenant();
  const { isLoadingAuth } = useAuth();
  const [user, setUser] = useState(null);

  useEffect(() => {
    import('@/api/base44Client').then(({ base44 }) => {
      base44.auth.me().then(setUser).catch(() => {});
    });
  }, []);

  if (loading || isLoadingAuth) return null;

  // Solo admins/owners necesitan onboarding. Drivers y otros roles no.
  const needsOnboarding = user && (user.role === 'admin' || user.role === 'owner') && !tenantId && !loading;

  if (needsOnboarding) {
    return <TenantOnboarding onComplete={() => window.location.reload()} />;
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

        <Route path="/financial" element={<Financial />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/location" element={<Location />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/import" element={<Import />} />
        <Route path="/driver/home" element={<DriverHome />} />
        <Route path="/driver/profile" element={<DriverProfile />} />
        <Route path="/driver/trips" element={<DriverTrips />} />
        <Route path="/github" element={<GitHubPage />} />
        <Route path="/supabase" element={<SupabasePage />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/test-data" element={<TestData />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </TenantGate>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <TenantProvider>
            <AuthenticatedApp />
          </TenantProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App