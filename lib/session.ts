// Sesión de administración firmada con HMAC-SHA256 (Web Crypto: funciona en middleware y en servidor).
// Configuración: ADMIN_USER, ADMIN_PASSWORD y ADMIN_SESSION_SECRET (ver .env.example).

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 h

export interface AdminSession {
  user: string;
  exp: number; // epoch segundos
}

export function authConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** Sin contraseña configurada solo se permite el acceso en desarrollo (modo demo). */
export function demoAccessAllowed() {
  return !authConfigured() && process.env.NODE_ENV !== "production";
}

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string) {
  const s = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signSession(user: string): Promise<string> {
  const payload: AdminSession = { user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await hmac(body))}`;
}

export async function verifySession(token: string | undefined | null): Promise<AdminSession | null> {
  if (!token || !secret()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    if (!constantTimeEqual(await hmac(body), fromB64url(sig))) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as AdminSession;
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

/** Comprobación de credenciales en tiempo constante (compara HMAC de ambos valores). */
export async function checkCredentials(user: string, password: string) {
  if (!authConfigured()) return false;
  const expectedUser = process.env.ADMIN_USER || "admin";
  const [a, b, c, d] = await Promise.all([hmac(user), hmac(expectedUser), hmac(password), hmac(process.env.ADMIN_PASSWORD!)]);
  return constantTimeEqual(a, b) && constantTimeEqual(c, d);
}
