import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { isOwner, isAdminOrOwner } from '@/lib/permissions';
import { useTenant } from '@/lib/TenantContext';
import { Shield, Users, Building2, Mail, UserPlus, Crown, Navigation, Wrench, Car, User, CheckCircle2, RefreshCw, Edit2, Save, X, Palette, AlertTriangle, Trash2, ArrowRightLeft, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SuperAdminPanel from '@/components/admin/SuperAdminPanel';
import PermissionsPanel from '@/components/admin/PermissionsPanel';

const ROLE_CONFIG = {
  owner:      { label: 'Owner',      color: 'text-warning bg-warning/10',   icon: Crown },
  admin:      { label: 'Admin',      color: 'text-primary bg-primary/10',   icon: Shield },
  dispatcher: { label: 'Dispatcher', color: 'text-success bg-success/10',   icon: Navigation },
  mechanic:   { label: 'Mecánico',   color: 'text-muted-foreground bg-secondary', icon: Wrench },
  driver:     { label: 'Conductor',  color: 'text-muted-foreground bg-secondary', icon: Car },
  user:       { label: 'Usuario',    color: 'text-muted-foreground bg-secondary', icon: User },
};

function UserRow({ member, onRoleChange, isCurrentUser }) {
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

function InviteForm({ tenant, onInvited }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('driver');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    await (/** @type {any} */ (base44)).users.inviteUser(cleanEmail, role);
    // Registrar al invitado en members[] del tenant: es lo que ata al usuario a este
    // tenant (RLS de TenantLicense por members.email) y permite el descubrimiento en
    // el primer login del invitado.
    if (tenant?.id) {
      const existing = Array.isArray(tenant.members) ? tenant.members : [];
      if (!existing.some(m => m.email?.toLowerCase() === cleanEmail)) {
        await base44.entities.TenantLicense.update(tenant.id, {
          members: [...existing, { email: cleanEmail, role }],
        }).catch(() => {});
      }
    }
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
    slogan: license?.slogan || '',
    logo_url: license?.logo_url || '',
    owner_email: license?.owner_email || '',
    notes: license?.notes || '',
    color_primary: license?.color_primary || '',
    color_secondary: license?.color_secondary || '',
    color_accent: license?.color_accent || '',
    color_background: license?.color_background || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [logoError, setLogoError] = useState('');

  // Sugiere una paleta de 4 colores de marca analizando el logo con IA.
  const suggestColors = async (fileUrl) => {
    if (!fileUrl) return;
    setExtracting(true);
    setLogoError('');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analiza este logo y extrae una paleta de 4 colores en hex que representen la marca:
1. primary: el color más dominante/destacado del logo
2. secondary: color de apoyo o secundario
3. accent: color de acento o contraste
4. background: color de fondo apropiado (oscuro si el logo es claro, viceversa)

Responde SOLO el JSON con los 4 colores en formato hex (#RRGGBB). No incluyas texto adicional.`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: 'object',
          properties: {
            primary: { type: 'string' },
            secondary: { type: 'string' },
            accent: { type: 'string' },
            background: { type: 'string' },
          }
        }
      });
      const c = /** @type {{ primary?: string; secondary?: string; accent?: string; background?: string }} */ (result);
      setForm(f => ({
        ...f,
        color_primary: c.primary || f.color_primary,
        color_secondary: c.secondary || f.color_secondary,
        color_accent: c.accent || f.color_accent,
        color_background: c.background || f.color_background,
      }));
    } catch {
      setLogoError('No se pudieron sugerir los colores. Ajústalos manualmente.');
    } finally {
      setExtracting(false);
    }
  };

  // Sube el logo (SVG/PNG/JPG) desde el dispositivo y dispara la sugerencia de colores.
  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setLogoError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, logo_url: file_url }));
      await suggestColors(file_url);
    } catch {
      setLogoError('No se pudo subir el logo. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

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
          {license?.logo_url && <img src={license.logo_url} alt="logo" className="h-10 object-contain mb-1" />}
          <p className="text-sm font-semibold text-foreground">{license?.tenant_name || <span className="text-muted-foreground italic">Sin nombre</span>}</p>
          {license?.slogan && <p className="text-xs text-muted-foreground italic">{license.slogan}</p>}
          {license?.owner_email && <p className="text-xs text-muted-foreground">{license.owner_email}</p>}
          {(license?.color_primary || license?.color_secondary || license?.color_accent || license?.color_background) && (
            <div className="flex gap-1.5 mt-1">
              {[license.color_primary, license.color_secondary, license.color_accent, license.color_background].filter(Boolean).map((c, i) => (
                <div key={i} className="w-5 h-5 rounded-full border border-border" style={{ background: c }} title={c} />
              ))}
            </div>
          )}
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
          <label className="text-xs text-muted-foreground mb-1 block">Nombre de la organización</label>
          <Input value={form.tenant_name} onChange={e => setForm(f => ({ ...f, tenant_name: e.target.value }))} className="bg-secondary border-border text-sm h-8" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Slogan</label>
          <Input value={form.slogan} onChange={e => setForm(f => ({ ...f, slogan: e.target.value }))} className="bg-secondary border-border text-sm h-8" placeholder="Movilidad que conecta" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Email del owner</label>
          <Input value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} className="bg-secondary border-border text-sm h-8" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Logo</label>
          <div className="flex items-center gap-3 flex-wrap">
            <label className={`flex items-center gap-2 border-2 border-dashed border-border rounded-lg px-3 py-2 cursor-pointer hover:border-primary/50 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" className="h-8 object-contain" />
              ) : (
                <Upload className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {uploading ? 'Subiendo...' : form.logo_url ? 'Cambiar logo' : 'Subir logo (SVG, PNG o JPG)'}
              </span>
              <input
                type="file"
                accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                className="hidden"
                onChange={handleLogoFile}
                disabled={uploading}
              />
            </label>
            {form.logo_url && (
              <Button
                size="sm"
                variant="outline"
                type="button"
                className="h-8 gap-1.5 text-xs"
                onClick={() => suggestColors(form.logo_url)}
                disabled={extracting || uploading}
              >
                {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palette className="w-3.5 h-3.5" />}
                {extracting ? 'Sugiriendo...' : 'Sugerir colores del logo'}
              </Button>
            )}
          </div>
          <Input
            value={form.logo_url}
            onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            className="bg-secondary border-border text-xs h-7 mt-2"
            placeholder="…o pega una URL: https://..."
          />
          {logoError && <p className="text-xs text-destructive mt-1">{logoError}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
            <Palette className="w-3 h-3" /> Colores de la marca (hex)
            {extracting && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'color_primary', label: 'Principal' },
              { key: 'color_secondary', label: 'Secundario' },
              { key: 'color_accent', label: 'Acento' },
              { key: 'color_background', label: 'Fondo' },
            ].map(({ key, label }) => (
              <div key={key}>
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-4 h-4 rounded-full border border-border" style={{ background: form[key] || '#888' }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <Input
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="bg-secondary border-border text-xs h-7"
                  placeholder="#000000"
                />
              </div>
            ))}
          </div>
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
  const { tenant, tenantId, reload: reloadTenant } = useTenant();
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = () => {
    const filter = tenantId ? { 'data.tenant_id': tenantId } : {};
    base44.entities.User.filter(filter).then(users => {
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
  }, [tenantId]);

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
        <Button size="sm" variant="ghost" className="gap-2 text-xs text-muted-foreground" onClick={() => { setLoading(true); reloadTenant(); load(); }}>
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </div>

      {/* Tenant info */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Información del Tenant</h2>
        </div>
        <TenantEditor license={tenant} onSaved={() => { reloadTenant(); load(); }} />
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
          <InviteForm tenant={tenant} onInvited={load} />
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

      {/* Permisos granulares — solo admin del tenant */}
      <PermissionsPanel />

      {/* Danger Zone — solo admin del tenant */}
      {isAdminOrOwner(user?.role) && <DangerZone tenant={tenant} user={user} onDeleted={() => window.location.reload()} onDelegated={() => { reloadTenant(); load(); }} />}

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

function DangerZone({ tenant, user, onDeleted, onDelegated }) {
  const [delegateEmail, setDelegateEmail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [loadingDelegate, setLoadingDelegate] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [doneDelegate, setDoneDelegate] = useState(false);

  const handleDelegate = async () => {
    if (!delegateEmail.trim() || !tenant?.id) return;
    setLoadingDelegate(true);
    await base44.entities.TenantLicense.update(tenant.id, { owner_email: delegateEmail.trim() });
    setDoneDelegate(true);
    setLoadingDelegate(false);
    setTimeout(() => { setDoneDelegate(false); setDelegateEmail(''); onDelegated(); }, 2000);
  };

  const handleDelete = async () => {
    if (confirmDelete !== 'ELIMINAR' || !tenant?.id) return;
    setLoadingDelete(true);
    await base44.entities.TenantLicense.delete(tenant.id);
    setLoadingDelete(false);
    onDeleted();
  };

  return (
    <section className="border border-destructive/40 rounded-xl p-5 space-y-5 bg-destructive/5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide">Zona de Peligro</h2>
      </div>

      {/* Delegar ownership */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <ArrowRightLeft className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Delegar ownership</p>
            <p className="text-xs text-muted-foreground">Transfiere el control del tenant a otro usuario. Ingresa el email del nuevo owner.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="nuevo@owner.com"
            value={delegateEmail}
            onChange={e => setDelegateEmail(e.target.value)}
            className="bg-secondary border-border text-sm h-9 flex-1 min-w-[180px]"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-2 border-warning text-warning hover:bg-warning/10"
            disabled={loadingDelegate || doneDelegate || !delegateEmail.trim()}
            onClick={handleDelegate}
          >
            {doneDelegate ? <CheckCircle2 className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
            {doneDelegate ? 'Delegado' : 'Delegar'}
          </Button>
        </div>
      </div>

      {/* Eliminar tenant */}
      {tenant?.id && (
        <div className="space-y-2 border-t border-destructive/20 pt-4">
          <div className="flex items-start gap-3">
            <Trash2 className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Eliminar tenant</p>
              <p className="text-xs text-muted-foreground">Esta acción es irreversible. Escribe <span className="font-mono font-bold text-destructive">ELIMINAR</span> para confirmar.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="ELIMINAR"
              value={confirmDelete}
              onChange={e => setConfirmDelete(e.target.value)}
              className="bg-secondary border-border text-sm h-9 flex-1 min-w-[140px] font-mono"
            />
            <Button
              size="sm"
              variant="destructive"
              className="h-9 gap-2"
              disabled={loadingDelete || confirmDelete !== 'ELIMINAR'}
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
              {loadingDelete ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}