import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { UserPlus, Mail, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";
import {
  SocialButtons,
  OrDivider,
  AuthError,
  EmailField,
  PasswordField,
  SubmitButton,
} from "@/components/auth/parts";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email: email.trim(), password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "No pudimos crear la cuenta. Puede que el correo ya esté registrado.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email: email.trim(), otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Código incorrecto o expirado.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email.trim());
      toast({ title: "Código reenviado", description: "Revisa tu correo." });
    } catch (err) {
      setError(err.message || "No pudimos reenviar el código.");
    }
  };

  const handleProvider = (provider) => base44.auth.loginWithProvider(provider, "/");

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title="Verifica tu correo" subtitle={`Te enviamos un código a ${email}`}>
        <AuthError>{error}</AuthError>
        <div className="mb-6 flex justify-center">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
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
            "Verificar y entrar"
          )}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿No recibiste el código?{" "}
          <button onClick={handleResend} className="font-medium text-primary hover:underline">
            Reenviar
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Crea tu cuenta"
      subtitle="Empieza tu prueba de 30 días en Rumbo."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <SocialButtons onProvider={handleProvider} />
      <OrDivider />

      <AuthError>{error}</AuthError>

      <form onSubmit={handleSubmit} className="space-y-4">
        <EmailField value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <PasswordField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
        />
        <PasswordField
          id="confirm"
          label="Confirmar contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Repite la contraseña"
        />
        <SubmitButton loading={loading} idle="Crear cuenta" busy="Creando cuenta…" />
      </form>
    </AuthLayout>
  );
}
