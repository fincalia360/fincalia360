// Control de acceso en el servidor: sin sesión del equipo no se ve ni se descarga ningún dato de propietarios.
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const env = process.env as Record<string, string | undefined>;
const saved = { ...env };

beforeAll(() => {
  env.NODE_ENV = "production";
  env.ADMIN_PASSWORD = "contraseña-de-prueba-larga";
  env.ADMIN_SESSION_SECRET = "secreto-de-prueba-para-firmar-sesiones";
});
afterAll(() => {
  for (const k of ["NODE_ENV", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"]) env[k] = saved[k];
});

const call = async (path: string, cookie?: string) => {
  const { middleware } = await import("@/middleware");
  return middleware(new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} }));
};

describe("acceso al CRM", () => {
  it.each(["/admin", "/admin/leads", "/admin/negocio", "/admin/servicios", "/admin/leads/abc", "/valorar/resultado/abc", "/agent/abc"])(
    "%s sin sesión → al inicio de sesión",
    async (path) => {
      const res = await call(path);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    },
  );

  it.each(["/api/admin/leads/abc/export", "/api/admin/studies/export", "/api/leads", "/api/agent/abc"])("%s sin sesión → 401", async (path) => {
    expect((await call(path)).status).toBe(401);
  });

  it("una cookie de sesión falsificada no sirve", async () => {
    const res = await call("/admin/leads", "admin_session=admin.firma-falsa");
    expect(res.status).toBe(307);
  });

  it("con una sesión válida firmada sí se accede", async () => {
    const { signSession, SESSION_COOKIE } = await import("@/lib/session");
    const token = await signSession("admin");
    const res = await call("/admin/leads", `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("las páginas públicas siguen abiertas", async () => {
    expect((await call("/estudio")).status).toBe(200);
  });
});

describe("acceso a la Zona inmobiliarias", () => {
  it.each(["/zona-inmobiliarias/panel", "/zona-inmobiliarias/panel/contactos", "/zona-inmobiliarias/panel/inmuebles/abc"])("%s sin sesión → a la pantalla de acceso", async (path) => {
    const res = await call(path);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/zona-inmobiliarias$/);
  });

  it.each(["/api/zona/inmuebles/abc/fotos", "/api/zona/contactos/abc/export"])("%s sin sesión → 401", async (path) => {
    expect((await call(path)).status).toBe(401);
  });

  it("la sesión del administrador no abre la Zona inmobiliarias (son accesos distintos)", async () => {
    const { signSession, SESSION_COOKIE } = await import("@/lib/session");
    const res = await call("/zona-inmobiliarias/panel", `${SESSION_COOKIE}=${await signSession("admin")}`);
    expect(res.status).toBe(307);
  });

  it("el acceso, el portal y las fichas son públicos", async () => {
    for (const path of ["/zona-inmobiliarias", "/zona-inmobiliarias/recuperar", "/comprar", "/alquilar", "/inmueble/piso-venta-girona-f360-abc123"]) {
      expect((await call(path)).status).toBe(200);
    }
  });
});
