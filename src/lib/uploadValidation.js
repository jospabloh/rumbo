/**
 * Lightweight client-side guard for file uploads (audit/rumbo-full-review,
 * section "Upload handling"): the app previously trusted the `accept`
 * attribute alone, which only filters the OS file picker and is trivially
 * bypassable (rename any file, or drag-and-drop). The real enforcement lives
 * inside Base44's UploadFile platform integration, which this repo can't see
 * or verify — so this is defense-in-depth, not a replacement for it.
 *
 * Deliberately simple: checks extension (never the spoofable file.type MIME
 * string alone) and a size cap. Does not sniff magic bytes — that needs the
 * file's bytes read client-side, which is more cost than this pass's finding
 * warrants; extension + size closes the "wrong kind of file entirely" and
 * "accidentally huge upload" cases.
 */

/** Extracts the lowercase extension including the dot, e.g. ".pdf". */
function extOf(filename) {
  const m = /\.[^.]+$/.exec(String(filename || ''));
  return m ? m[0].toLowerCase() : '';
}

/**
 * @param {File} file
 * @param {{ extensions: string[], maxSizeMB: number }} rules
 *   `extensions` — lowercase, dot-prefixed allowlist, e.g. ['.jpg', '.png', '.pdf'].
 * @returns {string} '' if valid, otherwise a user-facing Spanish error message.
 */
export function validateUploadFile(file, { extensions, maxSizeMB }) {
  if (!file) return '';
  if (extensions?.length) {
    const ext = extOf(file.name);
    if (!ext || !extensions.includes(ext)) {
      return `Tipo de archivo no permitido. Usa: ${extensions.join(', ')}.`;
    }
  }
  if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
    return `El archivo supera el máximo de ${maxSizeMB} MB.`;
  }
  return '';
}
