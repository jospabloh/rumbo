import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Lock, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { AuthError, PasswordField, SubmitButton } from "@/components/auth/parts";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token") || searchParams.get("reset_token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken, newPassword });
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "El enlace es inválido o expiró. Solicita uno nuevo.");
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Enlace inválido"
        subtitle="Este enlace de restablecimiento está incompleto o expiró."
        footer={
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Solicitar un nuevo enlace
          </Link>
        }
      >
        <p className="text-center text-sm text-foreground">
          El enlace que usaste parece estar incompleto. Solicita un nuevo correo de
          restablecimiento.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={Lock} title="Nueva contraseña" subtitle="Elige una contraseña para tu cuenta.">
      <AuthError>{error}</AuthError>
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          label="Nueva contraseña"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
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
        <SubmitButton loading={loading} idle="Guardar contraseña" busy="Guardando…" />
      </form>
    </AuthLayout>
  );
}
