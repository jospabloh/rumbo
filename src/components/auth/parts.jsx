import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import AppleIcon from "@/components/AppleIcon";

// Piezas compartidas por las pantallas de autenticación, para que Login /
// Register / Forgot / Reset se vean idénticas y consistentes con la marca.

export function SocialButtons({ onProvider }) {
  return (
    <div className="space-y-2.5">
      <Button
        variant="outline"
        type="button"
        className="h-12 w-full text-sm font-medium"
        onClick={() => onProvider("google")}
      >
        <GoogleIcon className="mr-2 h-5 w-5" />
        Continuar con Google
      </Button>
      <Button
        variant="outline"
        type="button"
        className="h-12 w-full text-sm font-medium"
        onClick={() => onProvider("apple")}
      >
        <AppleIcon className="mr-2 h-5 w-5" />
        Continuar con Apple
      </Button>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-3 text-muted-foreground">o</span>
      </div>
    </div>
  );
}

export function AuthError({ children }) {
  if (!children) return null;
  return (
    <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
      {children}
    </div>
  );
}

export function EmailField(props) {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">Correo electrónico</Label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          className="h-12 pl-10"
          required
          {...props}
        />
      </div>
    </div>
  );
}

export function PasswordField({ id = "password", label = "Contraseña", labelRight = null, ...props }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelRight}
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id={id} type="password" placeholder="••••••••" className="h-12 pl-10" required {...props} />
      </div>
    </div>
  );
}

export function SubmitButton({ loading, idle, busy }) {
  return (
    <Button type="submit" className="h-12 w-full font-medium" disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {busy}
        </>
      ) : (
        idle
      )}
    </Button>
  );
}
