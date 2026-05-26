import { useState } from 'react';
import { Shield, Eye, Plus, Pencil, Trash2, RefreshCw, PauseCircle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Permisos granulares por rol para el admin del tenant
// Cada permiso tiene: ver, crear, editar, eliminar, y algunos tienen: pausar

const MODULES = [
  { key: 'vehicles',     label: 'Vehículos' },
  { key: 'drivers',      label: 'Conductores' },
  { key: 'trips',        label: 'Viajes' },
  { key: 'maintenance',  label: 'Mantenimiento' },
  { key: 'parts',        label: 'Inventario / Partes' },
  { key: 'fuel',         label: 'Combustible' },
  { key: 'fines',        label: 'Multas / Infracciones' },
  { key: 'insurance',    label: 'Seguros / Siniestros' },
  { key: 'alerts',       label: 'Alertas' },
  { key: 'messages',     label: 'Mensajes' },
  { key: 'location',     label: 'Ubicación' },
  { key: 'financial',    label: 'Financiero' },
  { key: 'reports',      label: 'Reportes / Importar' },
];

const ROLES_FOR_PERMS = ['admin', 'dispatcher', 'mechanic', 'driver'];

const ROLE_LABELS = {
  admin:      'Admin',
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

// Permisos por defecto según el diseño original del sistema
const DEFAULT_PERMISSIONS = {
  admin: {
    vehicles:    { view: true,  create: true,  edit: true,  delete: true,  pause: true  },
    drivers:     { view: true,  create: true,  edit: true,  delete: true,  pause: true  },
    trips:       { view: true,  create: true,  edit: true,  delete: true,  pause: false },
    maintenance: { view: true,  create: true,  edit: true,  delete: true,  pause: false },
    parts:       { view: true,  create: true,  edit: true,  delete: true,  pause: false },
    fuel:        { view: true,  create: true,  edit: true,  delete: true,  pause: false },
    fines:       { view: true,  create: true,  edit: true,  delete: true,  pause: false },
    insurance:   { view: true,  create: true,  edit: true,  delete: true,  pause: false },
    alerts:      { view: true,  create: true,  edit: true,  delete: true,  pause: false },
    messages:    { view: true,  create: true,  edit: true,  delete: true,  pause: false },
    location:    { view: true,  create: false, edit: false, delete: false, pause: false },
    financial:   { view: true,  create: true,  edit: true,  delete: true,  pause: false },
    reports:     { view: true,  create: true,  edit: false, delete: false, pause: false },
  },
  dispatcher: {
    vehicles:    { view: true,  create: true,  edit: true,  delete: false, pause: false },
    drivers:     { view: true,  create: true,  edit: true,  delete: false, pause: true  },
    trips:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    maintenance: { view: true,  create: false, edit: false, delete: false, pause: false },
    parts:       { view: false, create: false, edit: false, delete: false, pause: false },
    fuel:        { view: true,  create: true,  edit: true,  delete: false, pause: false },
    fines:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    insurance:   { view: true,  create: true,  edit: true,  delete: false, pause: false },
    alerts:      { view: true,  create: true,  edit: true,  delete: false, pause: false },
    messages:    { view: true,  create: true,  edit: true,  delete: false, pause: false },
    location:    { view: true,  create: false, edit: false, delete: false, pause: false },
    financial:   { view: false, create: false, edit: false, delete: false, pause: false },
    reports:     { view: false, create: false, edit: false, delete: false, pause: false },
  },
  mechanic: {
    vehicles:    { view: true,  create: false, edit: true,  delete: false, pause: true  },
    drivers:     { view: false, create: false, edit: false, delete: false, pause: false },
    trips:       { view: false, create: false, edit: false, delete: false, pause: false },
    maintenance: { view: true,  create: true,  edit: true,  delete: false, pause: false },
    parts:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    fuel:        { view: false, create: false, edit: false, delete: false, pause: false },
    fines:       { view: false, create: false, edit: false, delete: false, pause: false },
    insurance:   { view: false, create: false, edit: false, delete: false, pause: false },
    alerts:      { view: false, create: false, edit: false, delete: false, pause: false },
    messages:    { view: false, create: false, edit: false, delete: false, pause: false },
    location:    { view: false, create: false, edit: false, delete: false, pause: false },
    financial:   { view: false, create: false, edit: false, delete: false, pause: false },
    reports:     { view: false, create: false, edit: false, delete: false, pause: false },
  },
  driver: {
    vehicles:    { view: true,  create: false, edit: false, delete: false, pause: false },
    drivers:     { view: true,  create: false, edit: true,  delete: false, pause: false },
    trips:       { view: true,  create: true,  edit: true,  delete: false, pause: false },
    maintenance: { view: false, create: false, edit: false, delete: false, pause: false },
    parts:       { view: false, create: false, edit: false, delete: false, pause: false },
    fuel:        { view: true,  create: true,  edit: false, delete: false, pause: false },
    fines:       { view: true,  create: false, edit: false, delete: false, pause: false },
    insurance:   { view: true,  create: false, edit: false, delete: false, pause: false },
    alerts:      { view: true,  create: false, edit: false, delete: false, pause: false },
    messages:    { view: true,  create: true,  edit: false, delete: false, pause: false },
    location:    { view: false, create: false, edit: false, delete: false, pause: false },
    financial:   { view: false, create: false, edit: false, delete: false, pause: false },
    reports:     { view: false, create: false, edit: false, delete: false, pause: false },
  },
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
  const [activeRole, setActiveRole] = useState('dispatcher');
  const [perms, setPerms] = useState(DEFAULT_PERMISSIONS);
  const [saved, setSaved] = useState(false);

  const toggle = (module, action) => {
    setPerms(p => ({
      ...p,
      [activeRole]: {
        ...p[activeRole],
        [module]: {
          ...p[activeRole][module],
          [action]: !p[activeRole][module][action],
        },
      },
    }));
  };

  const savePerms = () => {
    // En una implementación real, esto se guardaría en TenantLicense.features o en user data
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          <Button size="sm" className="gap-1.5 text-xs h-7" onClick={savePerms}>
            {saved ? <Check className="w-3 h-3" /> : null}
            {saved ? 'Guardado' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {/* Role tabs */}
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

      {/* Header row */}
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
                        value={perms[activeRole][mod.key][a.key]}
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

      <div className="px-4 py-3 border-t border-border bg-secondary/10">
        <p className="text-xs text-muted-foreground">
          Los permisos se aplican al rol seleccionado dentro de este tenant. El rol <span className="text-foreground font-medium">Admin</span> siempre tiene acceso completo por defecto.
        </p>
      </div>
    </section>
  );
}