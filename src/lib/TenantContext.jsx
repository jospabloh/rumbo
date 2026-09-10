/**
 * TenantContext — provee el tenant_id y la info del tenant actual a toda la app.
 *
 * Cómo funciona:
 * - El admin/owner crea su TenantLicense al hacer onboarding.
 * - El tenant_id es el id del registro TenantLicense creado por ese admin.
 * - Todos los registros del catálogo se crean con ese tenant_id.
 * - Las consultas se filtran por tenant_id para aislar datos entre tenants.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { invokeFunction } from '@/lib/invokeFunction';
import { getLicenseInfo, isReadOnly, isWriteBlocked } from '@/lib/license';

// Cada cuánto se revalida el tenant/licencia mientras la app está abierta. La licencia
// cambia de estado por día; revalidar periódicamente evita que una sesión que quedó
// abierta cruzando la fecha de vencimiento conserve permiso de escritura indefinidamente.
// El backend (resolveTenant) recalcula write_access en cada llamada.
const REVALIDATE_MS = 15 * 60 * 1000;

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [isAppOwner, setIsAppOwner] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const user = await base44.auth.me();
      if (!user) { setLoading(false); return; }
      setUserRole(user.role || null);

      // Fuente de verdad: la función de servidor resuelve y persiste el tenant_id
      // (y el rol del invitado en su primer login) con service role. Robusto y escalable.
      let resolvedId = null;
      try {
        const body = await invokeFunction('resolveTenant', {});
        resolvedId = body?.tenant_id || null;
        setIsAppOwner(!!body?.is_app_owner);
      } catch (e) {
        console.error('resolveTenant falló, usando descubrimiento cliente:', e);
      }

      // La licencia completa (branding, plan, etc.) se lee del cliente; la RLS ya lo
      // permite porque el usuario pertenece al tenant.
      // Límite alineado con resolveTenant (1000): con 50 un owner cuyo tenant no estaba
      // entre los 50 más recientes quedaba sin resolver y caía al onboarding en bucle.
      const all = await base44.entities.TenantLicense.list('-created_date', 1000).catch(() => []);
      const email = (user.email || '').toLowerCase();

      let found = resolvedId ? all.find(t => t.id === resolvedId) || null : null;

      // Respaldo: si la función no resolvió, descubrir en cliente (sin caer a all[0],
      // que en multi-tenant asignaría al tenant equivocado).
      if (!found) {
        if (user.role === 'owner' || user.role === 'admin') {
          found = (user.data?.tenant_id && all.find(t => t.id === user.data.tenant_id))
            || all.find(t => t.created_by_id === user.id)
            || all.find(t => (t.owner_email || '').toLowerCase() === email)
            || all.find(t => Array.isArray(t.members) && t.members.some(m => (m.email || '').toLowerCase() === email))
            || null;
        } else {
          const drivers = await base44.entities.Driver.filter({ profile_id: user.id }).catch(() => []);
          if (drivers.length > 0 && drivers[0].tenant_id) {
            found = all.find(t => t.id === drivers[0].tenant_id) || null;
          }
        }
        // tenant_id es server-authoritative (write:false): solo resolveTenant (service
        // role) lo persiste. Si la función ya corrió arriba, el binding queda hecho del
        // lado servidor; el cliente no intenta escribir tenant_id (fallaría por RLS).
      }

      setTenant(found);
      setTenantId(found?.id || null);
    } catch (e) {
      console.error('TenantContext error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenant({ showLoading: true });
    // Revalidación periódica + al volver el foco a la pestaña: mantiene write_access
    // (y el estado de licencia que ve la UI) fresco sin obligar a recargar la página.
    // Silenciosa (sin showLoading) para no parpadear la app cada 15 min ni al enfocar.
    const interval = setInterval(() => { loadTenant(); }, REVALIDATE_MS);
    const onFocus = () => { if (document.visibilityState === 'visible') loadTenant(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onFocus); };
  }, []);

  const licenseInfo = getLicenseInfo(tenant);
  const readOnly = isReadOnly(licenseInfo);
  // Escritura bloqueada (readonly o disabled). El backend lo aplica de forma dura vía RLS;
  // esto solo es para que la UI oculte botones de crear/editar/eliminar.
  const writeBlocked = isWriteBlocked(licenseInfo);

  return (
    <TenantContext.Provider value={{
      tenant, tenantId, isAppOwner, userRole, loading,
      reload: () => loadTenant({ showLoading: true }),
      setTenant, licenseInfo, readOnly, writeBlocked,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}