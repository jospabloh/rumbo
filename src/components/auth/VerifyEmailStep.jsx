import { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/components/ui/use-toast';
import AuthLayout from '@/components/AuthLayout';
import { AuthError } from '@/components/auth/parts';
import { otpErrorMessage, resendErrorMessage } from '@/lib/authErrors';

/**
 * Paso "escribe el código que te enviamos" compartido por Register y Login.
 *
 * Base44 manda un código por correo al registrar; sin este paso la cuenta nunca
 * queda verificada y el login responde "Please verify your email". Register lo
 * abre tras crear la cuenta; Login lo abre cuando el login falla por correo sin
 * verificar (antes decía "contraseña incorrecta").
 *
 * Al verificar intenta iniciar sesión sola con el correo/contraseña que ya se
 * tecleó; si eso falla manda a /login (la cuenta ya quedó verificada).
 */
export default function VerifyEmailStep({ email, password, onCancel }) {
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    let hasToken = false;
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        hasToken = true;
      }
    } catch (err) {
      setError(otpErrorMessage(err));
      setLoading(false);
      return;
    }
    // Correo verificado. Sesión automática; si no se pudo, a /login.
    try {
      if (!hasToken) await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = '/';
    } catch {
      toast({ title: 'Correo verificado', description: 'Ya puedes iniciar sesión.' });
      window.location.href = '/login';
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      await base44.auth.resendOtp(email);
      toast({ title: 'Código reenviado', description: 'Revisa tu correo.' });
    } catch (err) {
      setError(resendErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout icon={Mail} title="Verifica tu correo" subtitle={`Te enviamos un código a ${email}`}>
      <AuthError>{error}</AuthError>
      <div className="mb-6 flex justify-center">
        <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button className="h-12 w-full font-medium" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verificando…
          </>
        ) : (
          'Verificar y entrar'
        )}
      </Button>
      <div className="mt-4 flex justify-between text-sm">
        <button type="button" onClick={handleResend} disabled={resending} className="font-medium text-primary hover:underline">
          {resending ? 'Enviando…' : 'Reenviar código'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            Usar otro correo
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
