// Autenticación del panel de administración.
// - Con ADMIN_PASSWORD definido: login en /login y sesión firmada (cookie httpOnly).
// - Sin ADMIN_PASSWORD: acceso libre SOLO en desarrollo (demo). En producción el panel se bloquea.
// TODO producción avanzada: usuarios y roles en base de datos o SSO (Auth.js / Clerk).
import { cookies } from "next/headers";
import { SESSION_COOKIE, authConfigured, demoAccessAllowed, verifySession } from "./session";

export interface AdminUser {
  id: string;
  name: string;
  role: "admin" | "agent" | "agency";
  demo: boolean;
}

export async function getCurrentUser(): Promise<AdminUser | null> {
  if (demoAccessAllowed()) return { id: "demo-admin", name: "Admin demo", role: "admin", demo: true };
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? { id: session.user, name: session.user, role: "admin", demo: false } : null;
}

/** Punto único para exigir permisos en server actions y rutas del panel. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("No autorizado");
  return user;
}

export { authConfigured };
