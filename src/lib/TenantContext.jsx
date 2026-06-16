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

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) { setLoading(false); return; }

      // Drivers usan el tenant del driver vinculado
      // Admins/owners usan el tenant que crearon (created_by_id)
      const all = await base44.entities.TenantLicense.list('-created_date', 50);

      let found = null;

      if (user.role === 'owner' || user.role === 'admin') {
        // Primero por tenant_id guardado en el perfil del usuario
        // Luego por creador, por owner_email, por miembro en members[], o primer tenant
        found = (user.data?.tenant_id && all.find(t => t.id === user.data.tenant_id))
          || all.find(t => t.created_by_id === user.id)
          || all.find(t => t.owner_email === user.email)
          || all.find(t => Array.isArray(t.members) && t.members.some(m => m.email === user.email))
          || all[0]; // fallback: primer tenant
      } else {
        // Para dispatcher, mechanic, driver: buscar el tenant al que pertenecen
        // Se detecta por: hay algún Driver con profile_id === user.id → obtener su tenant_id
        const drivers = await base44.entities.Driver.filter({ profile_id: user.id });
        if (drivers.length > 0 && drivers[0].tenant_id) {
          found = all.find(t => t.id === drivers[0].tenant_id) || null;
        } else {
          found = all[0] || null;
        }
      }

      // Persist tenant_id on the user profile BEFORE exposing the tenant to the app.
      // Every entity's RLS checks {{user.data.tenant_id}}, so creates/updates are
      // rejected (403) until this is saved server-side. This MUST be awaited: otherwise
      // a freshly-onboarded user can open a form and hit "Guardar" before their profile
      // has the tenant_id, and the save fails silently.
      if (found?.id && user.data?.tenant_id !== found.id) {
        try {
          await base44.auth.updateMe({ tenant_id: found.id });
        } catch (e) {
          console.error('No se pudo asociar el tenant al usuario:', e);
        }
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

  return (
    <TenantContext.Provider value={{ tenant, tenantId, loading, reload: loadTenant, setTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}