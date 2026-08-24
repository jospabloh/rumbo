import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { isOwner, isAdminOrOwner } from '@/lib/permissions';
import { useTenant } from '@/lib/TenantContext';
import { Shield, Users, Building2, Mail, Crown, Car, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import SuperAdminPanel from '@/components/admin/SuperAdminPanel';
import PermissionsPanel from '@/components/admin/PermissionsPanel';
import BusinessSettingsPanel from '@/components/admin/BusinessSettingsPanel';
import UserRow from '@/components/admin/UserRow';
import InviteForm from '@/components/admin/InviteForm';
import TenantEditor from '@/components/admin/TenantEditor';
import JoinCodeCard from '@/components/admin/JoinCodeCard';
import DangerZone from '@/components/admin/DangerZone';
import { useMe } from '@/hooks/useEntities';

export default function Admin() {
  const { tenant, tenantId, reload: reloadTenant } = useTenant();
  const { data: user, isLoading: meLoading } = useMe();
  const allowed = isAdminOrOwner(user?.role);

  // Members are scoped by `data.tenant_id` (a server-side filter path), so this read
  // can't use the generic tenant-scoped useEntityList; it stays a dedicated query.
  const membersQ = useQuery({
    queryKey: ['admin-members', tenantId ?? null],
    queryFn: () => base44.entities.User.filter(tenantId ? { 'data.tenant_id': tenantId } : {}),
    enabled: allowed,
  });
  const members = membersQ.data ?? [];
  const refresh = () => membersQ.refetch();

  const loading = meLoading || (allowed && membersQ.isLoading);
  const accessDenied = !meLoading && !allowed;

  const handleRoleChange = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    refresh();
  };

  // El nombre para la app (display_name) lo puede editar el admin del tenant (RLS de
  // entidad permite a owner/admin actualizar usuarios de su tenant).
  const handleSetName = async (userId, displayName) => {
    await base44.entities.User.update(userId, { display_name: displayName }).catch(() => {});
    refresh();
  };

  // Grupo de sociedad de un usuario 'investor': debe coincidir con el mismo campo en
  // los Vehicle a los que debe ver (estado, mantenimientos y rentas de solo lectura).
  // write:false para todos salvo owner/admin (RLS de entidad de User).
  const handleSetOwnerGroup = async (userId, ownerGroupId) => {
    await base44.entities.User.update(userId, { owner_group_id: ownerGroupId || null }).catch(() => {});
    refresh();
  };

  // Suspender / reactivar / quitar pasa por la función de servidor (write_access,
  // suspended y tenant_id son server-authoritative; el cliente no puede tocarlos).
  const handleManage = async (userId, action, name) => {
    if (action === 'remove' && !window.confirm(`¿Quitar a ${name} de la organización? Perderá el acceso, pero su cuenta no se elimina.`)) return;
    try {
      const res = await base44.functions.invoke('manageMember', { action, userId });
      const data = res?.data || res;
      if (data?.error) { alert(data.error); return; }
      refresh();
    } catch {
      alert('No se pudo completar la acción. Intenta de nuevo.');
    }
  };

  if (loading) return <PageLoader className="h-64" />;

  if (accessDenied) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <Shield className="w-12 h-12 opacity-30" />
      <p className="text-lg font-medium">Acceso restringido</p>
      <p className="text-sm">Solo administradores pueden ver esta sección.</p>
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Panel de Administración</h1>
          <p className="text-sm text-muted-foreground">Gestión de tenant, usuarios y licencia</p>
        </div>
        <Button size="sm" variant="ghost" className="gap-2 text-xs text-muted-foreground" onClick={() => { reloadTenant(); refresh(); }}>
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </div>

      {/* Tenant info */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Información del Tenant</h2>
        </div>
        <TenantEditor license={tenant} onSaved={() => { reloadTenant(); refresh(); }} />
        {tenant && (
          <div className="flex items-center gap-3 pt-2 border-t border-border flex-wrap">
            <span className="text-xs text-muted-foreground">Plan: <span className="text-foreground font-medium capitalize">{tenant.plan}</span></span>
            <span className="text-xs text-muted-foreground">Estado: <span className={`font-medium ${tenant.status === 'active' ? 'text-success' : 'text-destructive'}`}>{tenant.status}</span></span>
            {tenant.trial_ends_at && (
              <span className="text-xs text-muted-foreground">
                Trial hasta: <span className="text-foreground font-medium">{new Date(tenant.trial_ends_at).toLocaleDateString('es-MX')}</span>
              </span>
            )}
          </div>
        )}
      </section>

      {/* Código de unión */}
      {tenant && <JoinCodeCard tenant={tenant} onChanged={() => { reloadTenant(); }} />}

      {/* Users */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Usuarios ({members.length})</h2>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No hay usuarios registrados.</div>
        ) : (
          <ul className="divide-y divide-border">
            {members.map(m => (
              <UserRow
                key={m.id}
                member={m}
                onRoleChange={handleRoleChange}
                onSetName={handleSetName}
                onSetOwnerGroup={handleSetOwnerGroup}
                onManage={handleManage}
                canManage={isAdminOrOwner(user?.role)}
                isCurrentUser={m.id === user?.id}
              />
            ))}
          </ul>
        )}

        {/* Invite */}
        <div className="px-5 py-4 border-t border-border bg-secondary/30">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invitar usuario</p>
          </div>
          <InviteForm tenant={tenant} onInvited={refresh} />
        </div>
      </section>

      {/* Driver linking note */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Car className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Conductores y acceso a la app</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Para que un conductor acceda a la app, invítalo con rol <span className="text-foreground font-medium">Conductor</span> usando su email.
          Una vez que inicie sesión, ve a <span className="text-foreground font-medium">Conductores</span> y vincula su perfil con su cuenta desde el detalle del conductor.
        </p>
      </section>

      {/* Investor/socio linking note */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Socios/inversionistas y acceso a la app</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Invita al socio con rol <span className="text-foreground font-medium">Socio</span> y asígnale un <span className="text-foreground font-medium">grupo de sociedad</span> (texto libre, p. ej. "suegra") en su fila de usuario.
          Luego, en <span className="text-foreground font-medium">Vehículos</span>, pon ese mismo grupo en el campo "Grupo de sociedad" de cada unidad que le corresponda.
          El socio solo verá el estado, mantenimientos y pagos de renta de las unidades con ese grupo — nada más del tenant.
        </p>
      </section>

      {/* Configuración del negocio (bono de referido, costo/km, etc.) — owner/admin del tenant */}
      <BusinessSettingsPanel />

      {/* Permisos granulares — solo admin del tenant */}
      <PermissionsPanel />

      {/* Danger Zone — visible a admin/owner del tenant; delegar/eliminar están gateados
          adentro a solo owner (módulo 14, 2026-08-24) */}
      {isAdminOrOwner(user?.role) && (
        <DangerZone
          tenant={tenant}
          isOwner={isOwner(user?.role)}
          onDeleted={() => window.location.reload()}
          onDelegated={() => { reloadTenant(); refresh(); }}
        />
      )}

      {/* Super Admin Panel — solo owner de la app */}
      {isOwner(user?.role) && (
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-warning" />
            <p className="text-xs font-semibold text-warning uppercase tracking-wider">Zona exclusiva — Owner de la plataforma</p>
          </div>
          <SuperAdminPanel />
        </div>
      )}
    </div>
  );
}
