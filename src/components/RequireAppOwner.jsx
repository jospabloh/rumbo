import { useTenant } from '@/lib/TenantContext';
import { PageLoader } from '@/components/ui/spinner';

/**
 * RequireAppOwner — guard de ruta para páginas exclusivas del owner de la app
 * (gestión de Supabase, GitHub, licencias y datos de prueba). Mientras carga el
 * contexto de tenant no decide; si el usuario no es app owner, bloquea el acceso.
 */
export default function RequireAppOwner({ children }) {
  const { isAppOwner, loading } = useTenant();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  if (!isAppOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Acceso restringido</h2>
          <p className="text-muted-foreground mt-1">Esta sección es exclusiva del administrador de la aplicación.</p>
        </div>
      </div>
    );
  }

  return children;
}
