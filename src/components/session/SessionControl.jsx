import { useAuth } from '@/lib/AuthContext';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import IdleWarningDialog from '@/components/session/IdleWarningDialog';
import SessionExpiredDialog from '@/components/session/SessionExpiredDialog';

// Module 20 (session control), Layer 1 — mounted once, app-wide, next to
// SessionHeartbeat (Layer 2's device/heartbeat tracking) in App.jsx. See
// useSessionManager.js for why Layer 1 and Layer 2 stayed two separate hooks
// instead of one merged one.
export default function SessionControl() {
  const { isAuthenticated } = useAuth();
  const { idleState, sessionExpired, continueSession } = useSessionManager();
  useActivityTracker(isAuthenticated);

  return (
    <>
      <IdleWarningDialog open={idleState === 'idle_warning'} onContinue={continueSession} />
      <SessionExpiredDialog open={sessionExpired} />
    </>
  );
}
