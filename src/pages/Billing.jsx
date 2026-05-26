import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { isAdminOrOwner } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, ShieldCheck, AlertTriangle, CheckCircle2, Clock, Truck, Users, Crown, Shield, Navigation, Wrench, Car, User } from 'lucide-react';

const ROLE_CONFIG = {
  owner:      { label: 'Owner',       icon: Crown,      color: 'text-warning bg-warning/10' },
  admin:      { label: 'Admin',       icon: Shield,     color: 'text-primary bg-primary/10' },
  dispatcher: { label: 'Dispatcher',  icon: Navigation, color: 'text-success bg-success/10' },
  mechanic:   { label: 'Mecánico',    icon: Wrench,     color: 'text-muted-foreground bg-secondary' },
  driver:     { label: 'Conductor',   icon: Car,        color: 'text-muted-foreground bg-secondary' },
  user:       { label: 'Usuario',     icon: User,       color: 'text-muted-foreground bg-secondary' },
};

const PLAN_LABELS = {
  trial: { label: 'Prueba gratuita', color: 'bg-muted text-muted-foreground' },
  starter: { label: 'Starter', color: 'bg-primary/20 text-primary' },
  pro: { label: 'Pro', color: 'bg-success/20 text-success' },
  enterprise: { label: 'Enterprise', color: 'bg-warning/20 text-warning' },
};

const STATUS_LABELS = {
  active: { label: 'Activa', icon: CheckCircle2, color: 'text-success' },
  expired: { label: 'Vencida', icon: AlertTriangle, color: 'text-destructive' },
  suspended: { label: 'Suspendida', icon: AlertTriangle, color: 'text-warning' },
  cancelled: { label: 'Cancelada', icon: AlertTriangle, color: 'text-muted-foreground' },
};

const PLAN_FEATURES = {
  trial:      ['Dashboard', 'Conductores (5)', 'Vehículos (5)', 'Mantenimiento'],
  starter:    ['Dashboard', 'Conductores (15)', 'Vehículos (15)', 'Mantenimiento', 'Financiero', 'Mensajes'],
  pro:        ['Todo Starter', 'Conductores (50)', 'Vehículos (50)', 'Ubicación en tiempo real', 'Alertas automáticas', 'Importación CSV'],
  enterprise: ['Sin límites', 'API access', 'Soporte prioritario', 'GitHub/Supabase integración'],
};

export default function Billing() {
  const [user, setUser] = useState(null);
  const [license, setLicense] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (!isAdminOrOwner(u?.role)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      Promise.all([
        base44.entities.TenantLicense.list('-created_date', 1),
        base44.entities.Vehicle.list(),
        base44.entities.Driver.list(),
        base44.entities.User.list(),
      ]).then(([lic, v, d, users]) => {
        setLicense(lic[0] || null);
        setVehicles(v);
        setDrivers(d);
        setMembers(users);
        setLoading(false);
      });
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <ShieldCheck className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium">Acceso restringido</p>
        <p className="text-sm">Solo el owner del tenant puede ver esta sección.</p>
      </div>
    );
  }

  const plan = license?.plan || 'trial';
  const status = license?.status || 'active';
  const planInfo = PLAN_LABELS[plan];
  const statusInfo = STATUS_LABELS[status];
  const StatusIcon = statusInfo.icon;

  const daysUntilRenewal = license?.renews_at
    ? Math.ceil((new Date(license.renews_at) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const daysUntilTrial = license?.trial_ends_at
    ? Math.ceil((new Date(license.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Licencia y Facturación</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestión del plan y uso del tenant</p>
      </div>

      {/* License card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Plan actual</p>
              <p className="text-xs text-muted-foreground">{license?.owner_email || user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${planInfo.color}`}>
              {planInfo.label}
            </span>
            <span className={`flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusInfo.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="bg-secondary rounded-lg p-4">
            <Truck className="w-4 h-4 text-muted-foreground mb-1" />
            <p className="text-2xl font-bold text-foreground">{vehicles.length}</p>
            <p className="text-xs text-muted-foreground">de {license?.max_vehicles || 5} vehículos</p>
          </div>
          <div className="bg-secondary rounded-lg p-4">
            <Users className="w-4 h-4 text-muted-foreground mb-1" />
            <p className="text-2xl font-bold text-foreground">{drivers.length}</p>
            <p className="text-xs text-muted-foreground">de {license?.max_drivers || 5} conductores</p>
          </div>
          {daysUntilTrial !== null && (
            <div className={`rounded-lg p-4 ${daysUntilTrial <= 7 ? 'bg-critical/10' : 'bg-secondary'}`}>
              <Clock className={`w-4 h-4 mb-1 ${daysUntilTrial <= 7 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <p className={`text-2xl font-bold ${daysUntilTrial <= 7 ? 'text-destructive' : 'text-foreground'}`}>{daysUntilTrial}</p>
              <p className="text-xs text-muted-foreground">días de prueba</p>
            </div>
          )}
          {daysUntilRenewal !== null && (
            <div className={`rounded-lg p-4 ${daysUntilRenewal <= 14 ? 'bg-warning/10' : 'bg-secondary'}`}>
              <Clock className={`w-4 h-4 mb-1 ${daysUntilRenewal <= 14 ? 'text-warning' : 'text-muted-foreground'}`} />
              <p className={`text-2xl font-bold ${daysUntilRenewal <= 14 ? 'text-warning' : 'text-foreground'}`}>{daysUntilRenewal}</p>
              <p className="text-xs text-muted-foreground">días para renovar</p>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="pt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Funcionalidades incluidas</p>
          <div className="flex flex-wrap gap-2">
            {(PLAN_FEATURES[plan] || []).map(f => (
              <span key={f} className="flex items-center gap-1 text-xs bg-secondary px-3 py-1 rounded-full text-foreground">
                <CheckCircle2 className="w-3 h-3 text-success" />
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Plans comparison */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Planes disponibles</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(PLAN_LABELS).map(([key, info]) => (
            <div
              key={key}
              className={`bg-card border rounded-xl p-5 space-y-3 transition-all ${
                plan === key ? 'border-primary ring-1 ring-primary' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                {plan === key && <span className="text-xs text-primary font-medium">Actual</span>}
              </div>
              <ul className="space-y-1.5">
                {(PLAN_FEATURES[key] || []).map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan !== key && (
                <Button size="sm" variant="outline" className="w-full text-xs" disabled>
                  Contactar ventas
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {license?.notes && (
        <div className="bg-secondary border border-border rounded-lg p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Notas</p>
          {license.notes}
        </div>
      )}

      {/* Members */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Miembros del tenant ({members.length})
        </p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {members.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No hay miembros registrados.</div>
          ) : (
            <ul className="divide-y divide-border">
              {members.map(m => {
                const roleConf = ROLE_CONFIG[m.role] || ROLE_CONFIG['user'];
                const RoleIcon = roleConf.icon;
                return (
                  <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                      {m.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.full_name || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${roleConf.color}`}>
                      <RoleIcon className="w-3 h-3" />
                      {roleConf.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}