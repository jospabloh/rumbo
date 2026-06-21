import { Link, Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';
import { can, isDriver } from '@/lib/permissions';
import { PageLoader } from '@/components/ui/spinner';

/**
 * Guard de ruta por permisos.
 *
 * Antes la navegación se ocultaba por rol en la barra lateral, pero las rutas
 * no se protegían: un dispatcher podía abrir `/financial` o `/admin` escribiendo
 * la URL y la página se renderizaba (la RLS protege los datos, pero la UI
 * exponía controles que no debía). Este guard reaplica `can(role, page)` —el
 * mismo mapa que filtra la barra lateral— a nivel de ruta.
 *
 * - Mientras se resuelve el tenant/rol no decide (muestra el loader).
 * - Si el rol tiene acceso, renderiza la página.
 * - Si no: a un conductor lo manda a su panel; a los demás les muestra una
 *   pantalla de acceso restringido coherente con el tema.
 *
 * Acepta `page` (se valida con `can(role, page)`) o `roles` (lista explícita,
 * para rutas que no están en el mapa de permisos como la interfaz del conductor).
 *
 * @param {{ page?: string, roles?: string[], children: import('react').ReactNode }} props
 */
export default function RequireAccess({ page, roles, children }) {
  const { userRole, loading } = useTenant();

  if (loading) return <PageLoader />;

  const allowed = roles ? roles.includes(userRole) : can(userRole, page);
  if (allowed) return children;

  // Un conductor que cae en una ruta del staff va a su propia interfaz.
  if (isDriver(userRole)) return <Navigate to="/driver/home" replace />;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldAlert className="w-7 h-7 text-destructive" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">Acceso restringido</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Tu rol no tiene permiso para ver esta sección. Si crees que es un error, contacta al administrador de tu organización.
        </p>
      </div>
      <Link to="/" className="text-sm text-primary underline">Volver al inicio</Link>
    </div>
  );
}
