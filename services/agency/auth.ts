// Cuentas de la Zona inmobiliarias (separadas del acceso del administrador).
// - Contraseñas con scrypt; la cookie lleva un token aleatorio y en la base solo se guarda su hash,
//   así las sesiones se pueden cerrar desde el panel.
// - Bloqueo temporal tras 5 intentos fallidos. Mensajes de error genéricos (no revelan si un email existe).
// - Invitación y recuperación con enlaces de un solo uso que caducan.
import { cookies, headers } from "next/headers";
import { prisma } from "@/db/client";
import { demoToolsEnabled } from "@/lib/demo";
import { audit } from "@/services/audit";
import { sendEmail, type EmailResult } from "@/services/email/emailService";
import { burnPasswordCheck, hashPassword, hashToken, newOpaqueToken, passwordProblem, verifyPassword } from "@/lib/password";

export const AGENCY_COOKIE = "agency_session";
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const INVITE_HOURS = 72;
const RESET_MINUTES = 60;

export class AuthError extends Error {}

export interface AgencyContext {
  userId: string;
  userName: string;
  email: string;
  role: "OWNER" | "AGENT";
  agencyId: string;
  agencyName: string;
}

export const normalizeLoginEmail = (email: string) => email.trim().toLowerCase();

export async function siteUrl() {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Comprueba email y contraseña. Devuelve el usuario o un error genérico. */
export async function verifyCredentials(emailRaw: string, password: string) {
  const email = normalizeLoginEmail(emailRaw);
  const user = await prisma.agencyUser.findUnique({ where: { email }, include: { agency: true } });
  const generic = new AuthError("Email o contraseña incorrectos");
  if (!user || !user.passwordHash) {
    await burnPasswordCheck(password);
    throw generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthError(`Demasiados intentos fallidos. Vuelve a intentarlo en unos minutos o recupera la contraseña.`);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await prisma.agencyUser.update({
      where: { id: user.id },
      data: { failedLogins: failed >= MAX_FAILED ? 0 : failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    if (failed >= MAX_FAILED) await audit({ type: "SYSTEM" }, "agency_user.locked", "AgencyUser", user.id, null, user.agencyId);
    throw generic;
  }
  if (user.status !== "ACTIVE") throw new AuthError("Tu cuenta no está activa. Contacta con FINCALIA360.");
  if (!user.agency.crmAccess || user.agency.status !== "ACTIVE") throw new AuthError("El acceso de tu inmobiliaria no está activo. Contacta con FINCALIA360.");
  await prisma.agencyUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  return user;
}

export async function createSession(userId: string) {
  const { token, hash } = newOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await prisma.agencySession.create({ data: { id: hash, userId, expiresAt } });
  // Limpieza de sesiones caducadas del usuario
  await prisma.agencySession.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  return { token, expiresAt };
}

/**
 * Acceso de demostración (solo en local, nunca en la web publicada): entra como una inmobiliaria
 * FICTICIA para probar la Zona inmobiliarias sin crear cuentas. El usuario no tiene contraseña,
 * así que no se puede usar desde el formulario de acceso.
 */
export async function demoAgencyUser() {
  if (!demoToolsEnabled()) throw new AuthError("No disponible");
  const name = "Inmobiliaria de demostración (ficticia)";
  const agency =
    (await prisma.agency.findFirst({ where: { name } })) ??
    (await prisma.agency.create({
      data: { name, zones: "", email: "demo.inmobiliaria@example.com", phone: "000000000", languages: "es", propertyTypes: "", status: "ACTIVE", crmAccess: true, notes: "DEMO: datos ficticios para probar la Zona inmobiliarias en local." },
    }));
  if (!agency.crmAccess || agency.status !== "ACTIVE") await prisma.agency.update({ where: { id: agency.id }, data: { crmAccess: true, status: "ACTIVE" } });
  const email = "agente.demo@example.com";
  return (
    (await prisma.agencyUser.findUnique({ where: { email } })) ??
    prisma.agencyUser.create({ data: { agencyId: agency.id, email, name: "Agente de demostración", role: "OWNER", status: "ACTIVE" } })
  );
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(AGENCY_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Sesión válida a partir del token de la cookie (o null). Comprueba usuario e inmobiliaria activos. */
export async function sessionFromToken(token: string | undefined | null): Promise<AgencyContext | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const session = await prisma.agencySession.findUnique({ where: { id: hashToken(token) }, include: { user: { include: { agency: true } } } });
  if (!session || session.expiresAt < new Date()) return null;
  const { user } = session;
  if (user.status !== "ACTIVE" || !user.agency.crmAccess || user.agency.status !== "ACTIVE") return null;
  return {
    userId: user.id,
    userName: user.name,
    email: user.email,
    role: user.role === "OWNER" ? "OWNER" : "AGENT",
    agencyId: user.agencyId,
    agencyName: user.agency.name,
  };
}

export async function getAgencySession() {
  return sessionFromToken((await cookies()).get(AGENCY_COOKIE)?.value);
}

/** Punto único de control para páginas, acciones y rutas de la Zona inmobiliarias. */
export async function requireAgency(): Promise<AgencyContext> {
  const ctx = await getAgencySession();
  if (!ctx) throw new AuthError("Sesión caducada. Vuelve a entrar.");
  return ctx;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(AGENCY_COOKIE)?.value;
  if (token) await prisma.agencySession.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(AGENCY_COOKIE);
}

// ---------------------------------------------------------------------------
// Invitaciones y recuperación de contraseña
// ---------------------------------------------------------------------------

async function issueToken(userId: string, type: "INVITE" | "RESET") {
  await prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  const { token, hash } = newOpaqueToken();
  const expiresAt = new Date(Date.now() + (type === "INVITE" ? INVITE_HOURS * 3600_000 : RESET_MINUTES * 60_000));
  await prisma.authToken.create({ data: { userId, type, tokenHash: hash, expiresAt } });
  return { token, expiresAt };
}

export async function inviteLink(token: string) {
  return `${await siteUrl()}/zona-inmobiliarias/activar#${token}`;
}
export async function resetLink(token: string) {
  return `${await siteUrl()}/zona-inmobiliarias/restablecer#${token}`;
}

/** Crea (o reenvía) la invitación de un usuario. Devuelve el enlace para que el administrador pueda copiarlo. */
export async function sendInvitation(userId: string): Promise<{ link: string; email: EmailResult }> {
  const user = await prisma.agencyUser.findUniqueOrThrow({ where: { id: userId }, include: { agency: true } });
  const { token } = await issueToken(user.id, "INVITE");
  const link = await inviteLink(token);
  const email = await sendEmail({
    to: user.email,
    subject: "Tu acceso a la Zona inmobiliarias de FINCALIA360",
    text: `Hola ${user.name}:\n\nFINCALIA360 te ha dado acceso a la Zona inmobiliarias para ${user.agency.name}.\n\nCrea tu contraseña con este enlace (caduca en ${INVITE_HOURS} horas):\n${link}\n\nSi no esperabas este correo, ignóralo.`,
  });
  return { link, email };
}

/** Siempre responde igual, exista o no el email (no revela qué cuentas existen). */
export async function requestPasswordReset(emailRaw: string) {
  const user = await prisma.agencyUser.findUnique({ where: { email: normalizeLoginEmail(emailRaw) }, include: { agency: true } });
  if (!user || user.status !== "ACTIVE") return;
  const recent = await prisma.authToken.count({ where: { userId: user.id, type: "RESET", createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (recent >= 3) return;
  const { token } = await issueToken(user.id, "RESET");
  const link = await resetLink(token);
  const result = await sendEmail({
    to: user.email,
    subject: "Restablecer tu contraseña · FINCALIA360",
    text: `Hola ${user.name}:\n\nHemos recibido una solicitud para restablecer la contraseña de tu acceso a la Zona inmobiliarias.\n\nUsa este enlace (caduca en ${RESET_MINUTES} minutos):\n${link}\n\nSi no lo has pedido tú, ignora este correo: tu contraseña no cambiará.`,
  });
  await audit({ type: "PUBLIC" }, `agency_user.reset_requested.${result.status.toLowerCase()}`, "AgencyUser", user.id, null, user.agencyId);
}

/** El administrador genera un enlace de restablecimiento (para dárselo a la inmobiliaria si no hay correo). */
export async function adminResetLink(userId: string) {
  const { token } = await issueToken(userId, "RESET");
  return resetLink(token);
}

/** Usa un enlace de invitación o de recuperación para fijar la contraseña. */
export async function consumeToken(token: string, type: "INVITE" | "RESET", password: string) {
  const record = token ? await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } }) : null;
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    throw new AuthError("El enlace no es válido o ha caducado. Pide uno nuevo.");
  }
  if (record.user.status === "DISABLED") throw new AuthError("Tu cuenta está desactivada. Contacta con FINCALIA360.");
  const problem = passwordProblem(password, record.user.email);
  if (problem) throw new AuthError(problem);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.agencyUser.update({ where: { id: record.userId }, data: { passwordHash, status: "ACTIVE", failedLogins: 0, lockedUntil: null } }),
    // Un cambio de contraseña cierra todas las sesiones abiertas
    prisma.agencySession.deleteMany({ where: { userId: record.userId } }),
  ]);
  await audit({ type: "AGENCY_USER", id: record.userId, agencyId: record.user.agencyId }, type === "INVITE" ? "agency_user.activated" : "agency_user.password_reset", "AgencyUser", record.userId);
  return record.user;
}

export async function changePassword(ctx: AgencyContext, current: string, next: string) {
  const user = await prisma.agencyUser.findUniqueOrThrow({ where: { id: ctx.userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new AuthError("La contraseña actual no es correcta");
  const problem = passwordProblem(next, user.email);
  if (problem) throw new AuthError(problem);
  await prisma.agencyUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await prisma.agencySession.deleteMany({ where: { userId: user.id } });
  await audit({ type: "AGENCY_USER", id: user.id, agencyId: user.agencyId }, "agency_user.password_changed", "AgencyUser", user.id);
}
