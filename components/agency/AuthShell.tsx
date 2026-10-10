import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { getDictionary } from "@/lib/i18n";

/** Pantallas públicas de la Zona inmobiliarias (acceso, recuperación, activación). */
export function AuthShell({ title, description, children, aside }: { title: string; description?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  const dict = getDictionary("es");
  return (
    <div lang="es">
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="bg-sand-50">
        <div className={`container-page grid gap-10 py-12 sm:py-16 ${aside ? "lg:grid-cols-[1fr_420px] lg:items-start" : "max-w-md"}`}>
          {aside && <div className="order-2 lg:order-1">{aside}</div>}
          <div className="order-1 rounded-2xl border border-sand-200 bg-white p-6 shadow-soft sm:p-8 lg:order-2">
            <p className="eyebrow">Zona inmobiliarias</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-800">{title}</h1>
            {description && <p className="mt-1.5 text-sm text-ink-500">{description}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
