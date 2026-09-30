import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { UserPlus } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import VerifyEmailStep from "@/components/auth/VerifyEmailStep";
import { isNetworkError } from "@/lib/authErrors";
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
      setError(isNetworkError(err)
        ? "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
        : "No pudimos crear la cuenta. Puede que el correo ya esté registrado.");
    } finally {
      setLoading(false);
    }
  };

  const handleProvider = (provider) => base44.auth.loginWithProvider(provider, "/");

  if (showOtp) {
    return <VerifyEmailStep email={email.trim()} password={password} onCancel={() => { setShowOtp(false); setError(''); }} />;
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
