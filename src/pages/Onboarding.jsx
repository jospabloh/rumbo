/**
 * Onboarding — hub de bienvenida para usuarios sin organización.
 *
 * Se muestra a CUALQUIER usuario autenticado que todavía no pertenece a un tenant
 * (lo decide TenantGate en App.jsx). Es la puerta de entrada que faltaba: en lugar de
 * dejar caer al usuario en una app vacía y sin contexto, lo guía a:
 *   1. Crear su propia organización (flujo TenantOnboarding) — arranca su prueba de 30 días.
 *   2. Pedir unirse a una organización existente con su código de unión. El código
 *      NO da acceso: deja una solicitud pendiente que un owner/admin aprueba (y
 *      elige el rol) o rechaza desde Administración. Mientras espera, el usuario
 *      solo ve la pantalla "Solicitud enviada" (sobrevive a recargas: la refleja
 *      resolveTenant). No puede crear otra organización con una solicitud viva.
 *
 * Diseñado mobile-first: objetivos táctiles grandes, inputs de 16px (evitan el zoom de
 * iOS), safe-area para el notch, y sin dependencias de hover.
 */
import { useEffect, useState } from 'react';
import { invokeFunction } from '@/lib/invokeFunction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Users, ArrowRight, ArrowLeft, Loader2, KeyRound, CheckCircle2, ShieldCheck, Sparkles, Clock, XCircle } from 'lucide-react';
import { normalizeJoinCode } from '@/lib/joinCode';
import TenantOnboarding from './TenantOnboarding';

function JoinTenant({ onBack, onJoined, onRequested }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(null); // tenant info tras unirse

  const submit = async () => {
    const normalized = normalizeJoinCode(code);
    if (!normalized || normalized.length < 8) {
      setError('Escribe el código completo que te compartió tu administrador.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await invokeFunction('joinTenant', { code: normalized });
      if (data?.status === 'pending') {
        // Solicitud enviada: NO hay acceso todavía. resolveTenant la refleja y el
        // Onboarding pasa a la pantalla de espera.
        onRequested();
        return;
      }
      // 'approved' = ya estaba invitado por correo (pre-aprobado): entra directo.
      setJoined(data?.tenant || { tenant_name: 'tu organización' });
      // Pequeña pausa para que el usuario vea la confirmación antes de recargar.
      setTimeout(() => onJoined(data), 1400);
    } catch (e) {
      setError(e?.message || 'No pudimos unirte. Revisa el código e intenta de nuevo.');
      setLoading(false);
    }
  };

  if (joined) {
    return (
      <div className="text-center py-10">
        <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-1">¡Te uniste!</h2>
        <p className="text-muted-foreground">
          Bienvenido a <span className="text-foreground font-medium">{joined.tenant_name || 'tu organización'}</span>.
        </p>
        <p className="text-xs text-muted-foreground mt-2">Preparando tu acceso…</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground -ml-1"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="flex items-center gap-2">
        <span className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <KeyRound className="w-5 h-5" />
        </span>
        <div>
          <h2 className="font-semibold text-lg leading-tight">Pedir unirme con un código</h2>
          <p className="text-xs text-muted-foreground">Pídele el código de unión a tu administrador.</p>
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 block">Código de la organización</label>
        <Input
          value={code}
          onChange={e => { setCode(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="RUMBO-XXXXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          className="bg-secondary border-border text-base h-12 tracking-wider font-mono uppercase placeholder:font-sans placeholder:tracking-normal placeholder:lowercase"
        />
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

      <Button className="w-full h-12 text-base gap-2" onClick={submit} disabled={loading || !code.trim()}>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
        {loading ? 'Enviando…' : 'Pedir unirme'}
      </Button>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl p-3">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
        <span>
          Tu administrador recibirá la solicitud y, al aprobarla, elegirá el rol con el que entrarás.
          Mientras tanto no verás datos de la organización.
        </span>
      </div>
    </div>
  );
}

const POLL_MS = 30 * 1000;

// Pantalla de espera: hay una JoinRequest viva (pending) o resuelta en contra
// (rejected). Nada de la organización se muestra. Revisa sola cada 30 s y al
// volver a la pestaña; si el admin aprueba, resolveTenant ya devuelve el tenant
// y TenantGate sale del onboarding sin más.
function JoinRequestStatus({ request, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (request.status !== 'pending') return undefined;
    const t = setInterval(() => { onRefresh(); }, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') onRefresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [request.status, onRefresh]);

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      await invokeFunction('joinTenant', { action: 'cancel' });
      await onRefresh();
    } catch (e) {
      setError(e?.message || 'No pudimos cancelar la solicitud. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const rejected = request.status === 'rejected';
  const Icon = rejected ? XCircle : Clock;
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5 text-center">
      <span className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${rejected ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
        <Icon className="w-7 h-7" />
      </span>
      {rejected ? (
        <>
          <h2 className="text-xl font-bold">Solicitud no aprobada</h2>
          <p className="text-sm text-muted-foreground">
            El administrador de <span className="text-foreground font-medium">{request.tenantName}</span> no aprobó tu
            solicitud. Si crees que es un error, pídele que te comparta el código de nuevo.
          </p>
          <Button className="w-full h-12" onClick={cancel} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Entendido
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold">Solicitud enviada</h2>
          <p className="text-sm text-muted-foreground">
            Esperando aprobación del administrador de <span className="text-foreground font-medium">{request.tenantName}</span>.
            Cuando la apruebe entrarás automáticamente; puedes cerrar esta pantalla y volver más tarde.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full h-11" onClick={() => onRefresh()}>
              Revisar estado
            </Button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar solicitud
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}

function Choice({ icon: Icon, title, desc, badge = null, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-card p-5 active:scale-[0.99] transition-transform hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <div className="flex items-center gap-4">
        <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-foreground">{title}</p>
            {badge && <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full">{badge}</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{desc}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </div>
    </button>
  );
}

export default function Onboarding({ user, onComplete, joinRequest = null, onRefresh = () => {} }) {
  const [mode, setMode] = useState('choose'); // 'choose' | 'create' | 'join'

  const firstName = (user?.full_name || '').trim().split(' ')[0];

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-5"
      style={{
        paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-lg">
        {joinRequest ? (
          <>
            <div className="text-center mb-7">
              <img src="/rumbo.png" alt="Rumbo" className="w-14 h-14 rounded-2xl mx-auto mb-3 object-cover" />
              <h1 className="text-2xl font-bold text-foreground">
                {firstName ? `Hola, ${firstName}` : 'Bienvenido a Rumbo'}
              </h1>
            </div>
            <JoinRequestStatus request={joinRequest} onRefresh={onRefresh} />
          </>
        ) : mode === 'create' ? (
          <TenantOnboarding onComplete={onComplete} onBack={() => setMode('choose')} />
        ) : mode === 'join' ? (
          <>
            <div className="text-center mb-7">
              <img src="/rumbo.png" alt="Rumbo" className="w-14 h-14 rounded-2xl mx-auto mb-3 object-cover" />
              <h1 className="text-2xl font-bold text-foreground">Unirte a una organización</h1>
            </div>
            <JoinTenant onBack={() => setMode('choose')} onJoined={onComplete} onRequested={onRefresh} />
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <img src="/rumbo.png" alt="Rumbo" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-cover" />
              <h1 className="text-2xl font-bold text-foreground">
                {firstName ? `Hola, ${firstName}` : 'Bienvenido a Rumbo'}
              </h1>
              <p className="text-muted-foreground mt-1">¿Cómo quieres empezar?</p>
            </div>

            <div className="space-y-3">
              <Choice
                icon={Building2}
                title="Crear mi organización"
                badge="30 días gratis"
                desc="Soy dueño o administrador de una flotilla. Quiero configurarla desde cero."
                onClick={() => setMode('create')}
              />
              <Choice
                icon={Users}
                title="Unirme a una organización"
                desc="Mi equipo ya usa Rumbo. Tengo un código y pediré acceso."
                onClick={() => setMode('join')}
              />
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Sin tarjeta. Prueba todas las funciones durante 30 días.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
