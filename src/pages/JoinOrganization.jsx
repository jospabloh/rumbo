import { useNavigate } from 'react-router-dom';
import Onboarding from './Onboarding';
import { useTenant } from '@/lib/TenantContext';
import { useMe } from '@/hooks/useEntities';
import { PageLoader } from '@/components/ui/spinner';

/**
 * JoinOrganization — el mismo Onboarding de siempre, pero alcanzable desde
 * DENTRO de la app por un usuario que ya tiene organización activa.
 *
 * Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md): unirse a un
 * segundo tenant por código ya no está bloqueado en el backend (joinTenant),
 * pero antes de esta página no había ninguna forma de LLEGAR a la pantalla de
 * unión una vez onboardeado — `TenantGate` solo monta `Onboarding` cuando
 * `tenantId` es null, y `/onboarding` no era una ruta registrada. Mismo
 * patrón que "Crear o unirme a otro negocio" de CtrlHQ.
 *
 * `onComplete` recarga el contexto de tenant (que ahora ve la membresía
 * nueva vía `resolveTenant`) y vuelve al dashboard — el join ya movió el
 * `tenant_id` activo al tenant recién unido, así que no hace falta un
 * switch aparte.
 */
export default function JoinOrganization() {
  const { data: user, isLoading } = useMe();
  const { reload } = useTenant();
  const navigate = useNavigate();

  if (isLoading || !user) return <PageLoader />;

  return (
    <Onboarding
      user={user}
      onComplete={() => {
        reload();
        navigate('/', { replace: true });
      }}
    />
  );
}
