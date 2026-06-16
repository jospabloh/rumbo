import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { Shield, Eye, Plus, Pencil, Trash2, RefreshCw, PauseCircle, Check, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_PERMISSIONS } from '@/lib/modulePerms';

const MODULES = [
  { key: 'vehicles',     label: 'Vehículos' },
  { key: 'drivers',      label: 'Conductores' },
  { key: 'rentas',       label: 'Rentas' },
  { key: 'trips',        label: 'Viajes' },
  { key: 'maintenance',  label: 'Mantenimiento' },
  { key: 'parts',        label: 'Inventario / Partes' },
  { key: 'fines',        label: 'Multas / Infracciones' },
  { key: 'insurance',    label: 'Seguros / Siniestros' },
  { key: 'alerts',       label: 'Alertas' },
  { key: 'messages',     label: 'Mensajes' },
  { key: 'location',     label: 'Ubicación' },
  { key: 'financial',    label: 'Financiero' },
  { key: 'reports',      label: 'Reportes / Importar' },
];

// Editable roles only — admin is always all-true and not configurable
const ROLES_FOR_PERMS = ['dispatcher', 'mechanic', 'driver'];

const ROLE_LABELS = {
  dispatcher: 'Dispatcher',
  mechanic:   'Mecánico',
  driver:     'Conductor',
};

const ACTIONS = [
  { key: 'view',   label: 'Ver',      icon: Eye },
  { key: 'create', label: 'Crear',    icon: Plus },
  { key: 'edit',   label: 'Editar',   icon: Pencil },
  { key: 'delete', label: 'Borrar',   icon: Trash2 },
  { key: 'pause',  label: 'Pausar',   icon: PauseCircle },
];

const DEFAULT_MODULE_PERMS = {
  dispatcher: { view: true,  create: true,  edit: true,  delete: false, pause: false },
  mechanic:   { view: true,  create: false, edit: true,  delete: false, pause: false },
  driver:     { view: true,  create: false, edit: false, delete: false, pause: false },
};

function PermCell({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
        value ? 'bg-success/20 text-success hover:bg-success/30' : 'bg-secondary text-muted-foreground/30 hover:bg-secondary/80'
      }`}
    >
      {value ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
    </button>
  );
}

export default function PermissionsPanel() {
  const { tenant, tenantId } = useTenant();
  const [activeRole, setActiveRole] = useState('dispatcher');
  const [perms, setPerms] = useState(DEFAULT_PERMISSIONS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Load saved permissions from TenantLicense when tenant loads
  useEffect(() => {
    if (!tenant?.permissions_config) return;
    try {
      const saved = tenant.permissions_config;
      setPerms(prev => ({
        ...DEFAULT_PERMISSIONS,
        dispatcher: { ...DEFAULT_PERMISSIONS.dispatcher, ...(saved.dispatcher || {}) },
        mechanic:   { ...DEFAULT_PERMISSIONS.mechanic,   ...(saved.mechanic   || {}) },
        driver:     { ...DEFAULT_PERMISSIONS.driver,     ...(saved.driver     || {}) },
      }));
    } catch {}
  }, [tenant?.id]);

  const getModulePerms = (role, moduleKey) => {
    if (perms[role]?.[moduleKey]) return perms[role][moduleKey];
    return DEFAULT_MODULE_PERMS[role] || { view: false, create: false, edit: false, delete: false, pause: false };
  };

  const toggle = (module, action) => {
    setPerms(p => ({
      ...p,
      [activeRole]: {
        ...p[activeRole],
        [module]: {
          ...getModulePerms(activeRole, module),
          [action]: !getModulePerms(activeRole, module)[action],
        },
      },
    }));
  };

  const savePerms = async () => {
    if (!tenantId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await base44.entities.TenantLicense.update(tenantId, { permissions_config: perms });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError('Error al guardar. Intenta de nuevo.');
      console.error('Permission save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const resetRole = () => {
    setPerms(p => ({
      ...p,
      [activeRole]: { ...DEFAULT_PERMISSIONS[activeRole] },
    }));
  };

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Permisos por Rol</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground h-7" onClick={resetRole}>
            <RefreshCw className="w-3 h-3" /> Restablecer
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" onClick={savePerms} disabled={saving}>
            {saved ? <Check className="w-3 h-3" /> : null}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="px-5 py-2 bg-destructive/10 text-destructive text-xs border-b border-destructive/20">
          {saveError}
        </div>
      )}

      {/* Admin all-true banner */}
      <div className="flex items-center gap-2 px-5 py-2.5 bg-primary/5 border-b border-border">
        <Lock className="w-3.5 h-3.5 text-primary" />
        <p className="text-xs text-primary font-medium">
          Admin — Acceso completo a todos los módulos (no configurable)
        </p>
      </div>

      {/* Role tabs — only editable non-admin roles */}
      <div className="flex border-b border-border bg-secondary/20">
        {ROLES_FOR_PERMS.map(r => (
          <button
            key={r}
            onClick={() => setActiveRole(r)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeRole === r
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Permissions table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary/10">
              <th className="text-left px-4 py-2.5 text-muted-foreground font-medium w-40">Módulo</th>
              {ACTIONS.map(a => (
                <th key={a.key} className="text-center px-2 py-2.5 text-muted-foreground font-medium min-w-[56px]">
                  <div className="flex flex-col items-center gap-1">
                    <a.icon className="w-3.5 h-3.5" />
                    {a.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {MODULES.map(mod => (
              <tr key={mod.key} className="hover:bg-accent/20 transition-colors">
                <td className="px-4 py-2.5 text-sm text-foreground font-medium">{mod.label}</td>
                {ACTIONS.map(a => (
                  <td key={a.key} className="px-2 py-2.5 text-center">
                    <div className="flex justify-center">
                      <PermCell
                        value={getModulePerms(activeRole, mod.key)[a.key]}
                        onChange={() => toggle(mod.key, a.key)}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-border bg-secondary/10 space-y-2">
        <p className="text-xs text-muted-foreground">
          Los permisos se aplican al rol seleccionado dentro de este tenant y se guardan en tu configuración. El rol <span className="text-foreground font-medium">Admin</span> siempre tiene acceso completo y no es configurable.
        </p>
        <p className="text-xs text-muted-foreground">
          Los roles <span className="text-foreground font-medium">Dispatcher, Mecánico y Conductor</span> inician con acceso mínimo. El admin debe habilitar cada permiso explícitamente.
        </p>
      </div>
    </section>
  );
}
