/**
 * Rumbo — Ciclo de vida de la licencia del tenant.
 *
 * Reglas (definidas por el owner de la app):
 *  - Primer mes gratis; después se cobra mensual o anual.
 *  - El owner confirma el pago y extiende `current_period_end`.
 *  - Si no hay pago al vencer:
 *      días vencidos 1–7   → past_due  (banner de aviso, app usable)
 *      días vencidos 8–15  → readonly  (solo lectura)
 *      días vencidos 16+   → disabled  (acceso desactivado)
 *  - `status` = 'suspended' | 'cancelled' fuerza desactivación inmediata (override manual del owner).
 */

export const SUPPORT_URL = 'https://acaciaco.com.mx/rumbo';

/**
 * Parsea una fecha 'YYYY-MM-DD' como medianoche LOCAL (no UTC).
 * `new Date('2026-07-03')` la interpreta como UTC, y en zonas negativas (México,
 * UTC-6/-7) al normalizar a local se corría un día, haciendo que el frontend
 * calculara la licencia un día más severo que el backend. Parsear componentes
 * evita ese desfase y mantiene front y back de acuerdo.
 */
export function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).split('-').map(Number);
  if (!y || !m || !d) { const dt = new Date(str); dt.setHours(0, 0, 0, 0); return dt; }
  return new Date(y, m - 1, d); // medianoche local
}

export function getLicenseInfo(tenant) {
  if (!tenant) return { state: 'active', daysLeft: null, overdue: 0, message: '' };

  if (tenant.status === 'cancelled') {
    return { state: 'disabled', daysLeft: null, overdue: null, message: 'Tu licencia fue cancelada.' };
  }
  if (tenant.status === 'suspended') {
    return { state: 'disabled', daysLeft: null, overdue: null, message: 'Tu cuenta está suspendida.' };
  }
  // 'expired' es un override manual del owner (igual que cancelled/suspended). Debe
  // cortar el acceso aunque current_period_end aún no haya pasado; si no, marcar
  // "Expirada" no revocaba nada (el cálculo por fechas la dejaba activa).
  if (tenant.status === 'expired') {
    return { state: 'disabled', daysLeft: null, overdue: null, message: 'Tu licencia expiró. Contacta a soporte para reactivarla.' };
  }

  const endStr = tenant.current_period_end || tenant.trial_ends_at;
  if (!endStr) return { state: 'active', daysLeft: null, overdue: 0, message: '' };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = parseLocalDate(endStr);
  const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000);

  if (daysLeft >= 0) {
    const soon = daysLeft <= 3
      ? `Tu licencia vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}.`
      : '';
    return { state: 'active', daysLeft, overdue: 0, message: soon };
  }

  const overdue = -daysLeft;
  if (overdue <= 7) {
    return {
      state: 'past_due', daysLeft, overdue,
      message: `No pudimos procesar tu pago. Tienes ${8 - overdue} día${8 - overdue === 1 ? '' : 's'} para renovar tu forma de pago antes de que la app pase a solo lectura.`,
    };
  }
  if (overdue <= 15) {
    return {
      state: 'readonly', daysLeft, overdue,
      message: 'Tu licencia venció: la app está en modo solo lectura. Renueva tu pago para reactivarla.',
    };
  }
  return {
    state: 'disabled', daysLeft, overdue,
    message: 'Tu acceso fue desactivado por falta de pago. Contacta a soporte.',
  };
}

export const isReadOnly = (info) => info?.state === 'readonly';
export const isDisabled = (info) => info?.state === 'disabled';

/**
 * Escritura bloqueada: readonly (8–15 días vencida) o disabled (16+ / suspended /
 * cancelled). active y past_due (gracia 1–7 días) sí permiten escribir.
 *
 * Espejo de computeWriteAccess() en base44/functions/resolveTenant: el frontend lo usa
 * para ocultar acciones; el backend lo aplica de forma dura vía RLS (write_access).
 */
export const isWriteBlocked = (info) => info?.state === 'readonly' || info?.state === 'disabled';
