/**
 * Soporte — catálogos y validación compartidos entre el formulario de ticket,
 * la lista del usuario ("Mis solicitudes") y el panel del owner de la app.
 */

export const TICKET_CATEGORIES = [
  { value: 'bug', label: 'Problema / error' },
  { value: 'question', label: 'Duda de uso' },
  { value: 'billing', label: 'Facturación / licencia' },
  { value: 'feature', label: 'Sugerencia' },
  { value: 'other', label: 'Otro' },
];

export const TICKET_PRIORITIES = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
];

// `color` mapea a las clases semánticas del tema (success/warning/primary/muted).
export const TICKET_STATUSES = [
  { value: 'open', label: 'Abierto', color: 'warning' },
  { value: 'in_progress', label: 'En proceso', color: 'primary' },
  { value: 'resolved', label: 'Resuelto', color: 'success' },
  { value: 'closed', label: 'Cerrado', color: 'muted' },
];

/** Devuelve la etiqueta legible de un valor en un catálogo (o el valor si no existe). */
export function labelFor(list, value, fallback = '—') {
  if (value == null || value === '') return fallback;
  return list.find((o) => o.value === value)?.label ?? value;
}

export const statusColor = (value) => TICKET_STATUSES.find((s) => s.value === value)?.color ?? 'muted';

/**
 * Valida el formulario de ticket. Devuelve un string con el error o null si es válido.
 * @param {{ subject?: string, body?: string }} input
 */
export function validateTicket({ subject, body } = {}) {
  const s = (subject || '').trim();
  const b = (body || '').trim();
  if (!s) return 'El asunto es requerido.';
  if (s.length < 4) return 'El asunto es muy corto.';
  if (!b) return 'Describe tu solicitud.';
  if (b.length < 10) return 'Agrega más detalle (mínimo 10 caracteres).';
  return null;
}
