import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authConfigured, demoAccessAllowed, verifySession } from "@/lib/session";

const LANGS = ["es", "ca", "en", "fr", "de", "nl", "it", "pt"];

/**
 * - Protege /admin y /api/admin: requiere sesión (login en /login) si ADMIN_PASSWORD está definido.
 *   Sin contraseña: acceso libre solo en desarrollo (demo); en producción se bloquea.
 * - Persiste el idioma elegido (?lang=xx) en una cookie.
 */
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const isApi = pathname.startsWith("/api/");
    if (!demoAccessAllowed()) {
      if (!authConfigured()) {
        return new NextResponse("Panel deshabilitado: configura ADMIN_PASSWORD y ADMIN_SESSION_SECRET.", { status: 503 });
      }
      const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
      if (!session) {
        if (isApi) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = `?next=${encodeURIComponent(pathname)}`;
        return NextResponse.redirect(url);
      }
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  const response = NextResponse.next();
  const lang = searchParams.get("lang");
  if (lang && LANGS.includes(lang)) {
    response.cookies.set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
