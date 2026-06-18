/**
 * joinCode — utilidades del código único de unión de cada tenant.
 *
 * El código permite que un usuario nuevo se una a un tenant existente sin que el admin
 * tenga que invitarlo por correo de antemano. Es la "llave" compartida del tenant, así
 * que se genera con suficiente entropía para que no sea adivinable y se normaliza para
 * que el usuario pueda teclearlo sin preocuparse por mayúsculas, espacios ni guiones.
 *
 * Formato visible: RUMBO-XXXXXX (6 caracteres de un alfabeto sin símbolos ambiguos:
 * sin 0/O, 1/I/L para evitar errores al dictarlo o teclearlo en el teléfono).
 */

// Alfabeto Crockford-ish sin caracteres que se confunden (0,O,1,I,L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 6;

/** Genera un código aleatorio nuevo, p. ej. "RUMBO-7QXM4P". */
export function generateJoinCode() {
  let body = '';
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(CODE_LEN);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < CODE_LEN; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  } else {
    for (let i = 0; i < CODE_LEN; i++) body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `RUMBO-${body}`;
}

/**
 * Normaliza lo que el usuario teclea a la forma canónica con la que se compara/almacena.
 * Quita espacios, guiones y guion bajo, pasa a mayúsculas y vuelve a armar
 * "RUMBO-XXXXXX". La comparación en backend se hace sobre esta forma para que el código
 * funcione sin importar cómo lo pegue o teclee el usuario en el teléfono.
 */
export function normalizeJoinCode(raw) {
  if (!raw) return '';
  let s = String(raw).toUpperCase().replace(/[\s_-]+/g, '');
  if (s.startsWith('RUMBO')) s = s.slice(5);
  return s ? `RUMBO-${s}` : '';
}

/** Forma compacta solo del cuerpo (sin prefijo), útil para comparaciones laxas. */
export function joinCodeBody(raw) {
  const n = normalizeJoinCode(raw);
  return n ? n.replace(/^RUMBO-/, '') : '';
}
