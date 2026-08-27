// Module 20 (session control), Layer 1. Adapted from
// jospabloh/acacia-app-standard → shared/session/SessionExpiredDialog.jsx — the
// only change from canonical is wiring the two buttons to THIS app's own
// useAuth() (logout/navigateToLogin from src/lib/AuthContext.jsx) instead of
// calling base44.auth.* directly, since this app already wraps those calls
// (token cleanup, forgetting the remembered identity) in its own AuthContext.
//
// Shown when the LOCAL idle timer expires (useSessionManager). A server-side
// revoke (Module 20 Layer 3's reap job, or Mission Control's manual
// force-logout) is handled separately by SessionHeartbeat.jsx's own existing
// `enforce()` check, which already calls logout() directly on the next
// heartbeat — that path predates this module and needed no change here.
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function SessionExpiredDialog({ open }) {
  const { logout, navigateToLogin } = useAuth();
  const handleLogin = () => navigateToLogin();
  const handleLogout = () => logout(true);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm mx-auto" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-destructive" />
            </div>
          </div>
          <DialogTitle className="text-center">Sesión expirada</DialogTitle>
          <DialogDescription className="text-center">
            Tu sesión ha expirado por inactividad. Vuelve a iniciar sesión para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={handleLogin} className="w-full">
            Volver a iniciar sesión
          </Button>
          <Button variant="outline" onClick={handleLogout} className="w-full">
            Cerrar sesión completamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
