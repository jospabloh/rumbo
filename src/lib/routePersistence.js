/**
 * Permanencia de navegación.
 *
 * Rumbo recuerda la última sección visitada y, al recargar la app (o volver a
 * abrirla), restaura esa sección en lugar de mandar siempre al inicio. Así el
 * usuario "se queda" donde estaba. La lógica se aísla en funciones puras para
 * poder probarla sin un router.
 */
export const LAST_PATH_KEY = 'rumbo:last-path';

/** ¿Vale la pena guardar esta ruta? (rutas internas, no la landing pública). */
export function shouldPersist(path) {
  return typeof path === 'string' && path.startsWith('/') && !/^\/landing/i.test(path);
}

/**
 * ¿Debe restaurarse la ruta guardada? Solo cuando se aterriza en la raíz `/`
 * (carga/recarga) y hay una ruta previa distinta de la raíz.
 */
export function shouldRestore(currentPath, savedPath) {
  if (currentPath !== '/') return false;
  if (!savedPath || savedPath === '/') return false;
  return savedPath.startsWith('/') && !/^\/landing/i.test(savedPath);
}
