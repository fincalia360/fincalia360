import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authConfigured, demoAccessAllowed, verifySession } from "@/lib/session";

const LANGS = ["es", "ca", "en", "fr", "de", "nl", "it", "pt"];
const TEAM_ONLY = ["/admin", "/api/admin", "/valorar/resultado", "/agent", "/api/agent", "/api/leads", "/api/slots"];

/**
 * - Protege /admin y /api/admin: requiere sesión (login en /login) si ADMIN_PASSWORD está definido.
 *   Sin contraseña: acceso libre solo en desarrollo (demo); en producción se bloquea.
 * - Persiste el idioma elegido (?lang=xx) en una cookie.
 */
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Solo para el equipo (sesión del panel): el panel, y las páginas y API de las solicitudes del
  // formulario antiguo, que se identifican solo por su número y contienen datos personales.
  if (TEAM_ONLY.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
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

  // Zona inmobiliarias: sin cookie de sesión se va a la pantalla de acceso. La sesión se valida de
  // verdad en el servidor (base de datos) en cada página, acción y ruta: esto solo evita el viaje.
  if (pathname.startsWith("/zona-inmobiliarias/panel") || pathname.startsWith("/api/zona/")) {
    const hasCookie = Boolean(request.cookies.get("agency_session")?.value);
    if (!hasCookie) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sesión caducada. Vuelve a entrar." }, { status: 401 });
      const url = request.nextUrl.clone();
      url.pathname = "/zona-inmobiliarias";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  // El formulario antiguo solo cubría 7 municipios de la Costa Brava con precios de ejemplo:
  // la captación nacional se hace con el estudio. Las páginas de resultado existentes se mantienen.
  if (pathname === "/valorar") {
    const url = request.nextUrl.clone();
    url.pathname = "/estudio";
    url.search = "";
    return NextResponse.redirect(url);
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
