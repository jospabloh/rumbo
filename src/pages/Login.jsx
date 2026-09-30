import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { LogIn } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import {
  SocialButtons,
  OrDivider,
  AuthError,
  EmailField,
  PasswordField,
  SubmitButton,
} from "@/components/auth/parts";
import VerifyEmailStep from "@/components/auth/VerifyEmailStep";
import { needsEmailVerification, loginErrorMessage } from "@/lib/authErrors";
import { getRememberedIdentity, clearRememberedIdentity } from "@/lib/lastIdentity";

export default function Login() {
  // "Recordar / tap once": si recordamos quién entró la última vez, prerellenamos
  // el correo y enfocamos la contraseña. El token nunca se guarda aquí — solo
  // nombre/correo cosméticos (ver lastIdentity.js).
  const remembered = getRememberedIdentity();
  const [email, setEmail] = useState(remembered?.email || "");
  const [recognized, setRecognized] = useState(Boolean(remembered?.email));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);

  const firstName = remembered?.name ? remembered.name.split(" ")[0] : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      window.location.href = "/";
    } catch (err) {
      // Solo credenciales malas dicen "incorrectos". Correo sin verificar abre el
      // paso del código (y manda uno nuevo); un fallo de red lo dice como tal.
      if (needsEmailVerification(err)) {
        try { await base44.auth.resendOtp(email.trim()); } catch { /* el paso permite reenviar */ }
        setNeedsVerify(true);
      } else {
        setError(loginErrorMessage(err));
      }
      setLoading(false);
    }
  };

  const handleProvider = (provider) => base44.auth.loginWithProvider(provider, "/");

  const useOtherAccount = () => {
    clearRememberedIdentity();
    setRecognized(false);
    setEmail("");
  };

  if (needsVerify) {
    return <VerifyEmailStep email={email.trim()} password={password} onCancel={() => { setNeedsVerify(false); setError(""); }} />;
  }

  return (
    <AuthLayout
      icon={LogIn}
      title={recognized && firstName ? `Hola de nuevo, ${firstName}` : "Bienvenido a Rumbo"}
      subtitle={
        recognized
          ? "Confirma tu contraseña para continuar."
          : "Inicia sesión para gestionar tu flotilla."
      }
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Crea una
          </Link>
        </>
      }
    >
      <SocialButtons onProvider={handleProvider} />
      <OrDivider />

      <AuthError>{error}</AuthError>

      <form onSubmit={handleSubmit} className="space-y-4">
        <EmailField
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus={!recognized}
        />
        <PasswordField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus={recognized}
          labelRight={
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          }
        />
        <SubmitButton loading={loading} idle="Iniciar sesión" busy="Entrando…" />
      </form>

      {recognized && (
        <button
          type="button"
          onClick={useOtherAccount}
          className="mt-4 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Usar otra cuenta
        </button>
      )}
    </AuthLayout>
  );
}
