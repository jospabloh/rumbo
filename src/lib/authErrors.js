// Clasificación de errores de autenticación por correo/contraseña (2026-09-30).
//
// Antes, Login mostraba "Correo o contraseña incorrectos" ante CUALQUIER error de
// loginViaEmailPassword. Una cuenta creada con correo/contraseña queda sin
// verificar hasta escribir el código que Base44 manda por correo; el login de esa
// cuenta responde algo como "Please verify your email", y la persona veía
// "contraseña incorrecta" sin saber que le faltaba el código. Mismo bug que se
// encontró en stockflow (PR #412).

const message = (err) => String(err?.message || err?.response?.data?.message || err?.response?.data?.detail || '');

/** La cuenta existe pero falta verificar el correo con el código. */
export const needsEmailVerification = (err) =>
  /verify your email|verification code|email (is )?not verified|not verified/i.test(message(err));

/** Falla de red: la petición nunca llegó (no es un problema de credenciales). */
export const isNetworkError = (err) =>
  !err?.response && /network error|failed to fetch|load failed|networkerror|timeout|timed out/i.test(message(err));

const isRateLimited = (err) =>
  err?.response?.status === 429 || /too many|rate limit|429/i.test(message(err));

/** Mensaje en español para un fallo de loginViaEmailPassword que NO es de verificación. */
export function loginErrorMessage(err) {
  if (isNetworkError(err)) return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  if (isRateLimited(err)) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  return 'Correo o contraseña incorrectos. Inténtalo de nuevo.';
}

/** Mensaje en español para un fallo al verificar el código (verifyOtp). */
export function otpErrorMessage(err) {
  if (isNetworkError(err)) return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  if (isRateLimited(err)) return 'Demasiados intentos. Espera unos minutos, o pide un código nuevo.';
  return 'Código incorrecto o vencido. Revísalo o pide uno nuevo.';
}

/** Mensaje en español para un fallo al reenviar el código (resendOtp). */
export function resendErrorMessage(err) {
  if (isNetworkError(err)) return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  if (isRateLimited(err)) return 'Ya te enviamos un código hace poco. Espera un momento antes de pedir otro.';
  return 'No pudimos reenviar el código. Inténtalo de nuevo en unos minutos.';
}
