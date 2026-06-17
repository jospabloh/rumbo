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
import { getLicenseInfo, isReadOnly } from '@/lib/license';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [isAppOwner, setIsAppOwner] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) { setLoading(false); return; }
      setUserRole(user.role || null);

      // Fuente de verdad: la función de servidor resuelve y persiste el tenant_id
      // (y el rol del invitado en su primer login) con service role. Robusto y escalable.
      let resolvedId = null;
      try {
        const res = await base44.functions.invoke('resolveTenant', {});
        resolvedId = res?.data?.tenant_id || null;
        setIsAppOwner(!!res?.data?.is_app_owner);
      } catch (e) {
        console.error('resolveTenant falló, usando descubrimiento cliente:', e);
      }

      // La licencia completa (branding, plan, etc.) se lee del cliente; la RLS ya lo
      // permite porque el usuario pertenece al tenant.
      const all = await base44.entities.TenantLicense.list('-created_date', 50).catch(() => []);
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

  useEffect(() => { loadTenant(); }, []);

  const licenseInfo = getLicenseInfo(tenant);
  const readOnly = isReadOnly(licenseInfo);

  return (
    <TenantContext.Provider value={{ tenant, tenantId, isAppOwner, userRole, loading, reload: loadTenant, setTenant, licenseInfo, readOnly }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}