import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { isOwner, isAdminOrOwner } from '@/lib/permissions';
import { Shield, Users, Building2, Mail, UserPlus, Trash2, Crown, Navigation, Wrench, Car, User, CheckCircle2, AlertTriangle, RefreshCw, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROLE_CONFIG = {
  owner:      { label: 'Owner',      color: 'text-warning bg-warning/10',   icon: Crown },
  admin:      { label: 'Admin',      color: 'text-primary bg-primary/10',   icon: Shield },
  dispatcher: { label: 'Dispatcher', color: 'text-success bg-success/10',   icon: Navigation },
  mechanic:   { label: 'Mecánico',   color: 'text-muted-foreground bg-secondary', icon: Wrench },
  driver:     { label: 'Conductor',  color: 'text-muted-foreground bg-secondary', icon: Car },
  user:       { label: 'Usuario',    color: 'text-muted-foreground bg-secondary', icon: User },
};

function UserRow({ member, onRoleChange, onInvite, isCurrentUser }) {
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState(member.role || 'user');
  const conf = ROLE_CONFIG[member.role] || ROLE_CONFIG['user'];
  const RoleIcon = conf.icon;

  const save = async () => {
    await onRoleChange(member.id, newRole);
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-3 px-5 py-3 flex-wrap">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
        {member.full_name?.charAt(0) || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {member.full_name || '—'}
          {isCurrentUser && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}
        </p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_CONFIG).map(([key, v]) => (
                <SelectItem key={key} value={key}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save}><Save className="w-3.5 h-3.5 text-success" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
        </div>
      ) : (
        <button
          onClick={() => !isCurrentUser && setEditing(true)}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${conf.color} ${!isCurrentUser ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
        >
          <RoleIcon className="w-3 h-3" />
          {conf.label}
          {!isCurrentUser && <Edit2 className="w-2.5 h-2.5 opacity-50 ml-0.5" />}
        </button>
      )}
    </li>
  );
}

function InviteForm({ onInvited }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('driver');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!email.trim()) return;
    setLoading(true);
    await base44.users.inviteUser(email.trim(), role);
    setDone(true);
    setLoading(false);
    setTimeout(() => { setDone(false); setEmail(''); onInvited(); }, 2000);
  };

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs text-muted-foreground mb-1 block">Email</label>
        <Input
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          className="bg-secondary border-border h-9 text-sm"
        />
      </div>
      <div className="w-36">
        <label className="text-xs text-muted-foreground mb-1 block">Rol</label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'owner').map(([key, v]) => (
              <SelectItem key={key} value={key}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" onClick={send} disabled={loading || done || !email.trim()} className="h-9 gap-2">
        {done ? <CheckCircle2 className="w-4 h-4 text-success" /> : <UserPlus className="w-4 h-4" />}
        {done ? 'Enviado' : 'Invitar'}
      </Button>
    </div>
  );
}

function TenantEditor({ license, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    tenant_name: license?.tenant_name || '',
    logo_url: license?.logo_url || '',
    owner_email: license?.owner_email || '',
    notes: license?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    if (license?.id) {
      await base44.entities.TenantLicense.update(license.id, form);
    } else {
      await base44.entities.TenantLicense.create({ ...form, plan: 'trial', status: 'active' });
    }
    setSaving(false);
    setEditing(false);
    onSaved();
  };

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{license?.tenant_name || <span className="text-muted-foreground italic">Sin nombre</span>}</p>
          {license?.owner_email && <p className="text-xs text-muted-foreground">{license.owner_email}</p>}
          {license?.notes && <p className="text-xs text-muted-foreground italic">{license.notes}</p>}
        </div>
        <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => setEditing(true)}>
          <Edit2 className="w-3.5 h-3.5" /> Editar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nombre del tenant</label>
          <Input value={form.tenant_name} onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))} className="bg-secondary border-border text-sm h-8" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Email del owner</label>
          <Input value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} className="bg-secondary border-border text-sm h-8" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">URL del logo</label>
          <Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} className="bg-secondary border-border text-sm h-8" placeholder="https://..." />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Notas internas</label>
          <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-secondary border-border text-sm h-8" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="gap-2">
          <Save className="w-3.5 h-3.5" /> Guardar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = () => {
    Promise.all([
      base44.entities.TenantLicense.list('-created_date', 1),
      base44.entities.User.list(),
    ]).then(([lic, users]) => {
      setLicense(lic[0] || null);
      setMembers(users);
      setLoading(false);
    });
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (!isAdminOrOwner(u?.role)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      load();
    }).catch(() => setLoading(false));
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
        <Button size="sm" variant="ghost" className="gap-2 text-xs text-muted-foreground" onClick={() => { setLoading(true); load(); }}>
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </div>

      {/* Tenant info */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Información del Tenant</h2>
        </div>
        <TenantEditor license={license} onSaved={load} />
        {license && (
          <div className="flex items-center gap-3 pt-2 border-t border-border flex-wrap">
            <span className="text-xs text-muted-foreground">Plan: <span className="text-foreground font-medium capitalize">{license.plan}</span></span>
            <span className="text-xs text-muted-foreground">Estado: <span className={`font-medium ${license.status === 'active' ? 'text-success' : 'text-destructive'}`}>{license.status}</span></span>
            {license.trial_ends_at && (
              <span className="text-xs text-muted-foreground">
                Trial hasta: <span className="text-foreground font-medium">{new Date(license.trial_ends_at).toLocaleDateString('es-MX')}</span>
              </span>
            )}
          </div>
        )}
      </section>

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
          <InviteForm onInvited={load} />
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
    </div>
  );
}