"use client";

import { useEffect, useState } from "react";
import { useActionForm } from "@/lib/useActionForm";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { AuthState } from "@/app/zona-inmobiliarias/authActions";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink-800 text-[15px] font-medium text-white hover:bg-ink-700 disabled:opacity-60">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
}

function ErrorText({ error }: { error?: string }) {
  return error ? (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {error}
    </p>
  ) : null;
}

export function LoginForm({ action }: { action: Action }) {
  const [state, onSubmit, pending] = useActionForm(action, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="field-label">Email</span>
        <input name="email" type="email" required autoComplete="username" maxLength={120} className="field" />
      </label>
      <label className="block">
        <span className="field-label">Contraseña</span>
        <input name="password" type="password" required autoComplete="current-password" maxLength={200} className="field" />
      </label>
      <ErrorText error={state.error} />
      <Submit pending={pending}>Entrar</Submit>
      <p className="text-center text-sm">
        <Link href="/zona-inmobiliarias/recuperar" className="text-ink-600 underline hover:text-ink-800">
          ¿Has olvidado tu contraseña?
        </Link>
      </p>
    </form>
  );
}

export function ResetRequestForm({ action }: { action: Action }) {
  const [state, onSubmit, pending] = useActionForm(action, {});
  if (state.done) {
    return (
      <div className="rounded-xl bg-pine-50 p-4 text-sm text-pine-700" role="status">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4" /> Revisa tu correo
        </p>
        <p className="mt-1">Si el email corresponde a una cuenta activa, te hemos enviado un enlace para crear una contraseña nueva. Caduca en 60 minutos.</p>
        <p className="mt-2 text-pine-700/80">¿No te llega? Revisa el correo no deseado o pide a FINCALIA360 un enlace nuevo.</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="field-label">Email de tu cuenta</span>
        <input name="email" type="email" required autoComplete="email" maxLength={120} className="field" />
      </label>
      <ErrorText error={state.error} />
      <Submit pending={pending}>Enviar enlace</Submit>
    </form>
  );
}

/** Crear contraseña (invitación) o restablecerla. El token llega en el fragmento (#) del enlace: no viaja en la URL al servidor. */
export function SetPasswordForm({ action, label }: { action: Action; label: string }) {
  const [state, onSubmit, pending] = useActionForm(action, {});
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const t = window.location.hash.slice(1);
    setToken(t);
    if (t) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (state.done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-pine-50 p-4 text-sm text-pine-700" role="status">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Contraseña guardada
          </p>
          <p className="mt-1">Ya puedes entrar con tu email y tu contraseña nueva.</p>
        </div>
        <Link href="/zona-inmobiliarias" className="flex h-11 w-full items-center justify-center rounded-full bg-ink-800 text-[15px] font-medium text-white hover:bg-ink-700">
          Ir al acceso
        </Link>
      </div>
    );
  }
  if (token === "") {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        Este enlace no es válido. Ábrelo directamente desde el correo o pide uno nuevo en{" "}
        <Link href="/zona-inmobiliarias/recuperar" className="underline">
          recuperar la contraseña
        </Link>
        .
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token ?? ""} />
      <label className="block">
        <span className="field-label">Contraseña nueva</span>
        <input name="password" type="password" required minLength={10} maxLength={200} autoComplete="new-password" className="field" />
        <span className="mt-1 block text-xs text-ink-400">Al menos 10 caracteres, con letras y números.</span>
      </label>
      <label className="block">
        <span className="field-label">Repite la contraseña</span>
        <input name="confirm" type="password" required minLength={10} maxLength={200} autoComplete="new-password" className="field" />
      </label>
      <ErrorText error={state.error} />
      <Submit pending={pending || token === null}>{label}</Submit>
    </form>
  );
}
