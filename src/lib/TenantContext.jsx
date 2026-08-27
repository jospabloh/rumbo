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
  // Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md): un mismo email puede
  // ser creador, owner_email o miembro de más de un TenantLicense a la vez.
  // `candidates` lleva TODOS los tenants a los que este email pertenece (aunque ya
  // haya uno activo, para poder ofrecer un selector persistente); `needsTenantChoice`
  // marca el caso ambiguo de primer login: nada persistido y más de un candidato.
  const [candidates, setCandidates] = useState([]);
  const [needsTenantChoice, setNeedsTenantChoice] = useState(false);
  const [switching, setSwitching] = useState(false);

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
        setCandidates(Array.isArray(body?.candidates) ? body.candidates : []);
        setNeedsTenantChoice(!!body?.needs_tenant_choice);
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

  // Cambia de tenant activo (Módulo 18). `switchTenant` valida server-side que el id
  // pedido en verdad pertenece al caller — este wrapper solo lo invoca y, si acepta,
  // recarga la página entera en vez de intentar resetear cada hook/lista/caché
  // tenant-scoped en el lugar: es el único reset que no puede dejar nada del tenant
  // anterior vivo en un closure (Módulo 14 §6 del estándar).
  const switchTenant = async (targetTenantId) => {
    if (!targetTenantId || targetTenantId === tenantId) return;
    setSwitching(true);
    try {
      await invokeFunction('switchTenant', { tenant_id: targetTenantId });
      window.location.reload();
    } catch (e) {
      setSwitching(false);
      throw e;
    }
  };

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
      candidates, needsTenantChoice, switchTenant, switching,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}