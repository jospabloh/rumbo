import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Mail, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { EmailField, SubmitButton } from "@/components/auth/parts";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email.trim());
    } catch {
      // Mostramos el mismo mensaje exista o no la cuenta (no revelamos correos).
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Restablecer contraseña"
      subtitle="Te enviaremos un enlace para crear una nueva."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <p className="text-center text-sm text-foreground">
          Si existe una cuenta con <span className="font-medium">{email}</span>, recibirás un
          correo con instrucciones en unos minutos.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <EmailField value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <SubmitButton loading={loading} idle="Enviar enlace" busy="Enviando…" />
        </form>
      )}
    </AuthLayout>
  );
}
