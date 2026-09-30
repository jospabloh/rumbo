import { describe, it, expect } from 'vitest';
import {
  needsEmailVerification,
  isNetworkError,
  loginErrorMessage,
  otpErrorMessage,
  resendErrorMessage,
} from '../authErrors.js';

describe('needsEmailVerification', () => {
  it('detecta los mensajes de correo sin verificar', () => {
    expect(needsEmailVerification(new Error('Please verify your email before logging in'))).toBe(true);
    expect(needsEmailVerification(new Error('Enter the verification code we sent'))).toBe(true);
    expect(needsEmailVerification({ response: { data: { message: 'Email not verified' } } })).toBe(true);
  });
  it('no confunde credenciales malas ni errores vacíos', () => {
    expect(needsEmailVerification(new Error('Invalid credentials'))).toBe(false);
    expect(needsEmailVerification(undefined)).toBe(false);
  });
});

describe('isNetworkError / mensajes', () => {
  const net = new Error('Network Error');
  it('una petición que nunca llegó es de red, no de credenciales', () => {
    expect(isNetworkError(net)).toBe(true);
    expect(loginErrorMessage(net)).toMatch(/conectar/);
    expect(otpErrorMessage(net)).toMatch(/conectar/);
    expect(resendErrorMessage(net)).toMatch(/conectar/);
  });
  it('un 401 con respuesta NO es de red', () => {
    const e = Object.assign(new Error('Request failed with status code 401'), { response: { status: 401 } });
    expect(isNetworkError(e)).toBe(false);
    expect(loginErrorMessage(e)).toBe('Correo o contraseña incorrectos. Inténtalo de nuevo.');
  });
  it('429 dice que esperes', () => {
    const e = Object.assign(new Error('x'), { response: { status: 429 } });
    expect(loginErrorMessage(e)).toMatch(/Demasiados intentos/);
    expect(otpErrorMessage(e)).toMatch(/Demasiados intentos/);
  });
  it('los mensajes van en español y sin rayas largas', () => {
    for (const m of [loginErrorMessage(net), otpErrorMessage(undefined), resendErrorMessage(undefined)]) {
      expect(m).not.toMatch(/—/);
      expect(m).not.toMatch(/Invalid|Please|failed/i);
    }
  });
});
