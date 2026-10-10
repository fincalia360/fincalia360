"use server";

// Acceso a la Zona inmobiliarias: entrar, salir, recuperar y crear la contraseña.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { AuthError, consumeToken, createSession, destroySession, requestPasswordReset, setSessionCookie, verifyCredentials } from "@/services/agency/auth";

export type AuthState = { error?: string; done?: boolean };

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Escribe tu email y tu contraseña" };
  const addr = await ip();
  if (!rateLimit(`agency-login:${addr}`, 20, 15 * 60_000).ok || !rateLimit(`agency-login:${email}`, 8, 15 * 60_000).ok) {
    return { error: "Demasiados intentos. Espera unos minutos." };
  }
  try {
    const user = await verifyCredentials(email, password);
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    console.error("[zona/login]", e);
    return { error: "No se ha podido iniciar sesión. Inténtalo de nuevo." };
  }
  redirect("/zona-inmobiliarias/panel");
}

export async function logoutAction() {
  await destroySession();
  redirect("/zona-inmobiliarias");
}

export async function requestResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.string().trim().email().max(120).safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Escribe un email válido" };
  if (!rateLimit(`agency-reset:${await ip()}`, 5, 15 * 60_000).ok) return { error: "Demasiadas solicitudes. Espera unos minutos." };
  await requestPasswordReset(parsed.data);
  // Misma respuesta exista o no la cuenta
  return { done: true };
}

export async function setPasswordAction(type: "INVITE" | "RESET", _prev: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Las contraseñas no coinciden" };
  if (!rateLimit(`agency-token:${await ip()}`, 10, 15 * 60_000).ok) return { error: "Demasiados intentos. Espera unos minutos." };
  try {
    await consumeToken(token, type, password);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    console.error("[zona/password]", e);
    return { error: "No se ha podido guardar la contraseña" };
  }
  return { done: true };
}
