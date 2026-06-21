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

// SLA de respuesta del equipo de soporte (horas hábiles).
export const SUPPORT_SLA_HOURS = 48;

// Coincidencias por palabra clave → sección del manual/Centro de ayuda. El orden
// importa: la primera que coincida gana.
const KEYWORD_SECTIONS = [
  { re: /(renta|cobro|pago|ingreso|adeudo)/i, section: 'Rentas', tip: 'Genera cobros por periodo y registra pagos desde la sección Rentas.' },
  { re: /(permiso|rol|acceso|no puedo (ver|entrar)|restring)/i, section: 'Admin y permisos', tip: 'Configura los permisos por rol en Admin → Permisos por rol.' },
  { re: /(licencia|venc|plan|factur|suscrip|cobr[oa] de licencia)/i, section: 'Licencia', tip: 'Revisa el estado de tu licencia y su renovación en la sección Licencia.' },
  { re: /(refacci|repuesto|stock|inventari)/i, section: 'Taller', tip: 'Administra refacciones y stock mínimo en Taller → Inventario.' },
  { re: /(mantenimiento|taller|servicio)/i, section: 'Taller', tip: 'Registra mantenimientos y su próxima fecha en Taller.' },
  { re: /(conductor|chofer|licencia de manejo)/i, section: 'Conductores', tip: 'Da de alta y administra conductores en la sección Conductores.' },
  { re: /(veh[ií]culo|placa|unidad|auto|carro)/i, section: 'Vehículos', tip: 'Administra la flotilla y su estatus en la sección Vehículos.' },
  { re: /(mensaje|chat|canal|voz)/i, section: 'Mensajes', tip: 'Usa canales de difusión o directos con tus conductores en Mensajes.' },
  { re: /(import|csv|carga masiva)/i, section: 'Importar', tip: 'Descarga la plantilla y revisa las filas con problemas en Importar.' },
  { re: /(tema|color|marca|logo|oscuro|claro|apariencia)/i, section: 'Interfaz y apariencia', tip: 'Cambia el tema y los colores de tu marca en Admin → Información de la organización.' },
  { re: /(alerta|vencimiento|documento|verificaci)/i, section: 'Alertas', tip: 'Las alertas se generan por documentos/servicios próximos a vencer; revísalas en Alertas.' },
  { re: /(ubicaci|gps|mapa|rastre)/i, section: 'Ubicación', tip: 'Solicita la ubicación de un conductor bajo demanda en Ubicación.' },
];

const CATEGORY_SECTIONS = {
  billing: { section: 'Licencia', tip: 'Las dudas de facturación y plan se gestionan en la sección Licencia.' },
  bug: { section: 'Guía por módulo', tip: 'Revisa la guía del módulo afectado en el Centro de ayuda antes de escalar.' },
  feature: { section: 'Guía por módulo', tip: 'Quizá la función ya exista; revisa la guía por módulo en el Centro de ayuda.' },
  question: { section: 'Guía por módulo', tip: 'Consulta la guía por módulo en el Centro de ayuda.' },
  other: { section: 'Guía por módulo', tip: 'Consulta la guía por módulo en el Centro de ayuda.' },
};

const GENERIC = { section: 'Guía por módulo', tip: 'Consulta la guía por módulo en el Centro de ayuda.' };

/**
 * Sugiere una sección del manual para intentar resolver el problema antes de
 * escalarlo a soporte. Busca por palabra clave en asunto+descripción y, si no
 * hay coincidencia, cae a la categoría. Pura y testeable.
 *
 * @param {string} category
 * @param {string} [text]
 * @returns {{ section: string, tip: string }}
 */
export function suggestSolution(category, text = '') {
  const haystack = String(text || '');
  for (const k of KEYWORD_SECTIONS) {
    if (k.re.test(haystack)) return { section: k.section, tip: k.tip };
  }
  return CATEGORY_SECTIONS[category] || GENERIC;
}

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
