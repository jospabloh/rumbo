import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, KeyRound, Copy, Check, Loader2 } from 'lucide-react';
import { generateJoinCode } from '@/lib/joinCode';
import { Button } from '@/components/ui/button';

/**
 * JoinCodeCard — muestra el código de unión del tenant para compartirlo con el equipo.
 * Cualquiera con el código puede unirse como conductor (mínimo privilegio); por eso se
 * permite regenerarlo (invalida el anterior) si se filtró.
 */
export default function JoinCodeCard({ tenant, onChanged }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const code = tenant?.join_code || '';

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* sin portapapeles: el usuario lo copia a mano */ }
  };

  const regenerate = async (confirmFirst) => {
    if (!tenant?.id) return;
    if (confirmFirst && !window.confirm('¿Generar un código nuevo? El código anterior dejará de funcionar.')) return;
    setBusy(true);
    try {
      await base44.entities.TenantLicense.update(tenant.id, { join_code: generateJoinCode() });
      onChanged();
    } catch { /* noop */ }
    finally { setBusy(false); }
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Código de unión</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Comparte este código para que alguien se una a tu organización. Entrará como
        <span className="text-foreground font-medium"> conductor</span> y luego puedes cambiar su rol arriba.
      </p>
      {code ? (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[160px] bg-secondary border border-border rounded-xl px-4 py-3 font-mono text-lg tracking-wider text-foreground text-center select-all">
            {code}
          </div>
          <Button variant="outline" className="h-12 w-12 p-0 shrink-0" onClick={copy} aria-label="Copiar código">
            {copied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5" />}
          </Button>
          <Button variant="outline" className="h-12 gap-2 shrink-0" onClick={() => regenerate(true)} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="hidden sm:inline">Regenerar</span>
          </Button>
        </div>
      ) : (
        <Button className="gap-2" onClick={() => regenerate(false)} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Generar código de unión
        </Button>
      )}
    </section>
  );
}
