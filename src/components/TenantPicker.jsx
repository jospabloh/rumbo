/**
 * TenantPicker — selector de organización a pantalla completa.
 *
 * Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md): se muestra en vez del
 * Onboarding cuando `resolveTenant` detecta que el email del usuario pertenece a
 * MÁS DE una organización y todavía no hay ninguna elegida — nunca se adivina cuál
 * usar. `TenantGate` en App.jsx decide cuándo montar este componente en lugar de
 * <Onboarding>; visualmente sigue el mismo layout de pantalla centrada.
 */
import { useState } from 'react';
import { Loader2, Building2, ChevronRight } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';

export default function TenantPicker({ user }) {
  const { candidates, switchTenant } = useTenant();
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');

  const firstName = (user?.full_name || '').trim().split(' ')[0];

  const pick = async (tenantId) => {
    setError('');
    setPendingId(tenantId);
    try {
      await switchTenant(tenantId);
      // switchTenant recarga la página en éxito; si algo sale mal, cae al catch.
    } catch (e) {
      setPendingId(null);
      setError('No pudimos entrar a esa organización. Intenta de nuevo.');
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-5"
      style={{
        paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src="/rumbo.png" alt="Rumbo" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-cover" />
          <h1 className="text-2xl font-bold text-foreground">
            {firstName ? `Hola, ${firstName}` : 'Bienvenido de vuelta'}
          </h1>
          <p className="text-muted-foreground mt-1">Perteneces a más de una organización. ¿Con cuál quieres entrar?</p>
        </div>

        <div className="space-y-2.5">
          {candidates.map((c) => {
            const isPending = pendingId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={pendingId !== null}
                onClick={() => pick(c.id)}
                className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/50 hover:bg-accent/50 transition-all disabled:opacity-60 disabled:cursor-wait"
              >
                {c.logo_url ? (
                  <img src={c.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                ) : (
                  <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-foreground truncate">
                    {c.tenant_name || 'Organización sin nombre'}
                  </span>
                </span>
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-destructive text-center mt-4">{error}</p>}
      </div>
    </div>
  );
}
