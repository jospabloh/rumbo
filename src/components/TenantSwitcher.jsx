/**
 * TenantSwitcher — control persistente para cambiar de organización activa.
 *
 * Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md). Solo se monta cuando
 * `candidates.length > 1` (Layout.jsx decide eso, no este componente) — un operador
 * con una sola organización nunca ve un control sin nada que hacer. Cambiar dispara
 * `switchTenant`, que valida el destino server-side y recarga la página entera al
 * terminar; este componente solo maneja el estado de "cambiando" mientras tanto.
 */
import { useState } from 'react';
import { Loader2, Building2, ChevronsUpDown, Check } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function TenantSwitcher() {
  const { tenant, tenantId, candidates, switchTenant, switching } = useTenant();
  const [error, setError] = useState('');

  if (!Array.isArray(candidates) || candidates.length < 2) return null;

  const pick = async (id) => {
    if (id === tenantId) return;
    setError('');
    try {
      await switchTenant(id);
    } catch (e) {
      setError('No pudimos cambiar de organización.');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={switching}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-sidebar-accent transition-all disabled:opacity-60"
          title="Cambiar de organización"
        >
          {switching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-[11px] text-muted-foreground truncate">Cambiar organización</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Tus organizaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {candidates.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => pick(c.id)} className="gap-2">
            {c.logo_url ? (
              <img src={c.logo_url} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <span className="flex-1 truncate">{c.tenant_name || 'Sin nombre'}</span>
            {c.id === tenantId && <Check className="w-4 h-4 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
        {error && <p className="text-xs text-destructive px-2 py-1.5">{error}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
