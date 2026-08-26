import { useState } from 'react';
import { CheckCircle2, Save, X, Edit2, Trash2, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_CONFIG } from '@/components/admin/roleConfig';

export default function UserRow({ member, onRoleChange, onSetName, onSetOwnerGroup, onManage, isCurrentUser, canManage }) {
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState(member.role || 'user');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(member.display_name || member.full_name || '');
  const [editingGroup, setEditingGroup] = useState(false);
  const [ownerGroup, setOwnerGroup] = useState(member.owner_group_id || '');
  const [busy, setBusy] = useState(false);
  const conf = ROLE_CONFIG[member.role] || ROLE_CONFIG['user'];
  const RoleIcon = conf.icon;
  const shownName = member.display_name || member.full_name || '—';
  const suspended = !!member.suspended;
  // El rol del owner no se toca desde este selector — transferir propiedad es
  // delegateOwnership (Zona de Peligro), no un cambio de rol; manageRole lo
  // rechaza igual del lado del servidor, esto solo evita el intento confuso.
  const isTargetOwner = member.role === 'owner';
  const roleLocked = isCurrentUser || isTargetOwner;

  const saveRole = async () => {
    await onRoleChange(member.id, newRole);
    setEditing(false);
  };

  const saveName = async () => {
    setBusy(true);
    await onSetName(member.id, name.trim());
    setBusy(false);
    setEditingName(false);
  };

  const saveOwnerGroup = async () => {
    setBusy(true);
    await onSetOwnerGroup(member.id, ownerGroup.trim());
    setBusy(false);
    setEditingGroup(false);
  };

  const manage = async (action) => {
    setBusy(true);
    await onManage(member.id, action, shownName);
    setBusy(false);
  };

  return (
    <li className="px-5 py-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
          {shownName.charAt(0) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                placeholder="Nombre para la app"
                className="h-8 text-sm bg-secondary border-border"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={saveName} disabled={busy}><Save className="w-4 h-4 text-success" /></Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setName(member.display_name || member.full_name || ''); setEditingName(false); }}><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
              {shownName}
              {isCurrentUser && <span className="text-xs text-muted-foreground">(tú)</span>}
              {suspended && <span className="text-[10px] font-bold uppercase text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Suspendido</span>}
              {canManage && (
                <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground" aria-label="Editar nombre">
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </p>
          )}
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
          {member.role === 'investor' && (
            editingGroup ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={ownerGroup}
                  onChange={e => setOwnerGroup(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveOwnerGroup()}
                  placeholder="Grupo de sociedad, ej. suegra"
                  className="h-7 text-xs bg-secondary border-border"
                  autoFocus
                />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={saveOwnerGroup} disabled={busy}><Save className="w-3.5 h-3.5 text-success" /></Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => { setOwnerGroup(member.owner_group_id || ''); setEditingGroup(false); }}><X className="w-3.5 h-3.5" /></Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Grupo: <span className="text-foreground font-medium">{member.owner_group_id || 'sin asignar'}</span>
                {canManage && (
                  <button onClick={() => setEditingGroup(true)} className="ml-1.5 text-muted-foreground hover:text-foreground align-middle" aria-label="Editar grupo de sociedad">
                    <Edit2 className="w-3 h-3 inline" />
                  </button>
                )}
              </p>
            )
          )}
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* 'owner' se excluye a propósito — transferir la propiedad tiene su
                    propio camino, más estrecho (delegateOwnership desde la Zona de
                    Peligro), no este selector. manageRole lo rechaza igual del lado
                    del servidor si de alguna forma llegara aquí. */}
                {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'owner').map(([key, v]) => (
                  <SelectItem key={key} value={key}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={saveRole}><Save className="w-4 h-4 text-success" /></Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing(false)}><X className="w-4 h-4" /></Button>
          </div>
        ) : (
          <button
            onClick={() => !roleLocked && setEditing(true)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${conf.color} ${!roleLocked ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
          >
            <RoleIcon className="w-3 h-3" />
            {conf.label}
            {!roleLocked && <Edit2 className="w-2.5 h-2.5 opacity-50 ml-0.5" />}
          </button>
        )}
      </div>

      {/* Acciones de gestión: solo para otros usuarios y si el actor puede gestionar. */}
      {canManage && !isCurrentUser && (
        <div className="flex items-center gap-2 pl-12">
          {suspended ? (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => manage('reactivate')} disabled={busy}>
              <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Reactivar
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => manage('suspend')} disabled={busy}>
              <Ban className="w-3.5 h-3.5 text-warning" /> Suspender
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={() => manage('remove')} disabled={busy}>
            <Trash2 className="w-3.5 h-3.5" /> Quitar
          </Button>
        </div>
      )}
    </li>
  );
}
