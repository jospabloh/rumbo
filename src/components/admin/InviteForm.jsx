import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormError } from '@/components/ui/form-error';
import { ROLE_CONFIG } from '@/components/admin/roleConfig';

export default function InviteForm({ tenant, onInvited }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('driver');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    try {
      // NUNCA llamar a base44.auth.inviteUser ni base44.users.inviteUser desde
      // aquí (2026-09-10, hallazgo real: Christian Cabral, owner de Car-Go
      // Rent, invitando desde su propia sesión — la app responde
      // "Could not validate credentials"). Reproducido contra el endpoint real
      // de Base44 (`POST /apps/{id}/users/invite-user`): un token de sesión
      // normal de un tenant owner produce el mismo 401 que un Bearer inválido a
      // propósito — este endpoint de la PLATAFORMA de Base44 no acepta el token
      // de sesión de un usuario final de la app, sin importar su rol dentro del
      // tenant; el SDK tampoco expone un equivalente en `asServiceRole` (no hay
      // `asServiceRole.auth`) para llamarlo con credenciales elevadas desde una
      // función de servidor. Es, en la práctica, una vía que solo funciona (si
      // acaso) para quien administra la app en el estudio de Base44 — nunca
      // para el owner de un tenant.
      //
      // La app ya no necesita esa llamada para que la invitación funcione: el
      // mismo mecanismo que ya usa el código de unión (joinTenant/resolveTenant)
      // sirve aquí. Agregar el correo a members[] es lo único que realmente ata
      // a la persona a este tenant; en cuanto esa persona inicie sesión por su
      // cuenta (Google o registro con correo/contraseña, usando ESTE MISMO
      // correo), `resolveTenant` la reconoce por `members[]` y la engancha sola
      // — no hace falta que la cuenta exista de antemano.
      if (tenant?.id) {
        const existing = Array.isArray(tenant.members) ? tenant.members : [];
        if (existing.some(m => m.email?.toLowerCase() === cleanEmail)) {
          setError('Ese correo ya está en tu organización.');
          setLoading(false);
          return;
        }
        await base44.entities.TenantLicense.update(tenant.id, {
          members: [...existing, { email: cleanEmail, role }],
        });
      }
      setDone(true);
      setTimeout(() => { setDone(false); setEmail(''); onInvited(); }, 3500);
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la invitación. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
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
      <FormError>{error}</FormError>
    </div>
  );
}
