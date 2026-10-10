import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";
import { LanguageSwitcher } from "./LanguageSwitcher";

const NAV = [
  ["Inicio", "/"],
  ["Comprar", "/comprar"],
  ["Alquilar", "/alquilar"],
  ["Valora tu vivienda", "/estudio"],
  ["Para propietarios", "/#servicios"],
  ["Zona inmobiliarias", "/zona-inmobiliarias"],
] as const;

/**
 * Cabecera de FINCALIA360. `showNav = false` se usa en las páginas de resultado de las
 * solicitudes antiguas, que siguen siendo multilingües (muestran el selector de idioma).
 */
export function SiteHeader({ dict, lang, basePath = "/", showNav = true }: { dict: Dictionary; lang: Language; basePath?: string; showNav?: boolean }) {
  void dict;
  return (
    <header className="sticky top-0 z-30 border-b border-sand-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-1 sm:h-[72px] sm:gap-4">
        <Link href="/" aria-label="FINCALIA360 · inicio" className="shrink-0">
          <Logo />
        </Link>
        {showNav ? (
          <>
            <nav aria-label="Principal" className="hidden items-center gap-4 whitespace-nowrap text-[14px] font-medium text-ink-500 lg:flex xl:gap-6 xl:text-[14.5px]">
              {NAV.map(([label, href]) => (
                <a key={href} href={href} className="hover:text-ink-800">
                  {label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Botón principal siempre visible (como antes de añadir el menú) */}
              <ButtonLink href="/estudio" variant="accent" size="md" className="h-9 shrink-0 px-2.5 text-[12px] sm:h-10 sm:px-4 sm:text-sm">
                Analizar mi vivienda
              </ButtonLink>
              {/* Menú en móvil y tableta (sin JavaScript) */}
              <details className="group relative lg:hidden">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-sand-300 px-1.5 sm:h-10 sm:px-4 text-sm font-medium text-ink-700 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden>☰</span> <span className="sr-only sm:not-sr-only">Menú</span>
                </summary>
                <nav aria-label="Principal" className="absolute right-0 top-12 z-40 w-60 rounded-2xl border border-sand-200 bg-white p-2 shadow-xl">
                  {NAV.map(([label, href]) => (
                    <a key={href} href={href} className="block rounded-lg px-3 py-2.5 text-[15px] text-ink-700 hover:bg-sand-50">
                      {label}
                    </a>
                  ))}
                </nav>
              </details>
            </div>
          </>
        ) : (
          <LanguageSwitcher current={lang} basePath={basePath} />
        )}
      </div>
    </header>
  );
}
