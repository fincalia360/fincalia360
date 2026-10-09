import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Logo } from "@/components/brand/Logo";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, authConfigured, checkCredentials, demoAccessAllowed, signSession } from "@/lib/session";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Acceso al panel", robots: { index: false, follow: false } };

function safeNext(value: string | undefined) {
  return value && value.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

async function login(formData: FormData) {
  "use server";
  const next = safeNext(String(formData.get("next") ?? ""));
  const h = await headers();
  const limited = rateLimit(clientKey(new Request("http://local", { headers: h }), "login"), 10, 15 * 60_000);
  if (!limited.ok) redirect(`/login?error=rate&next=${encodeURIComponent(next)}`);
  const ok = await checkCredentials(String(formData.get("user") ?? ""), String(formData.get("password") ?? ""));
  if (!ok) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  (await cookies()).set(SESSION_COOKIE, await signSession(String(formData.get("user"))), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect(next);
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (demoAccessAllowed()) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand-100 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-sand-200 bg-white p-8 shadow-soft">
        <Logo tagline="Panel del equipo" />
        {!authConfigured() ? (
          <p className="mt-6 text-sm text-red-700">El panel está deshabilitado: define ADMIN_PASSWORD y ADMIN_SESSION_SECRET en el entorno.</p>
        ) : (
          <form action={login} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="user" className="field-label">
                Usuario
              </label>
              <input id="user" name="user" required autoComplete="username" className="field" />
            </div>
            <div>
              <label htmlFor="password" className="field-label">
                Contraseña
              </label>
              <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
            </div>
            {params.error && (
              <p className="text-sm text-red-600" role="alert">
                {params.error === "rate" ? "Demasiados intentos. Espera unos minutos." : "Usuario o contraseña incorrectos."}
              </p>
            )}
            <SubmitButton className="w-full" pendingLabel="Entrando…">
              Entrar
            </SubmitButton>
          </form>
        )}
      </div>
    </main>
  );
}
