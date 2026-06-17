import { useTenant } from '@/lib/TenantContext';

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
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAppOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-800">Acceso restringido</h2>
          <p className="text-slate-500 mt-1">Esta sección es exclusiva del administrador de la aplicación.</p>
        </div>
      </div>
    );
  }

  return children;
}
