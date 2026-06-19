import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_CONFIG } from '@/components/admin/roleConfig';

export default function InviteForm({ tenant, onInvited }) {
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
