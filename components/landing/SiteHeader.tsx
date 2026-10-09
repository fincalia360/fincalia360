import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";
import { LanguageSwitcher } from "./LanguageSwitcher";

const NAV = [
  ["Servicios", "/#servicios"],
  ["Cómo funciona", "/#como-funciona"],
  ["Transparencia", "/#transparencia"],
  ["Preguntas frecuentes", "/#preguntas"],
] as const;

/**
 * Cabecera de FINCALIA360. `showNav = false` se usa en las páginas de resultado de las
 * solicitudes antiguas, que siguen siendo multilingües (muestran el selector de idioma).
 */
export function SiteHeader({ dict, lang, basePath = "/", showNav = true }: { dict: Dictionary; lang: Language; basePath?: string; showNav?: boolean }) {
  void dict;
  return (
    <header className="sticky top-0 z-30 border-b border-sand-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4 sm:h-[72px]">
        <Link href="/" aria-label="FINCALIA360 · inicio" className="shrink-0">
          <Logo />
        </Link>
        {showNav ? (
          <>
            <nav aria-label="Principal" className="hidden items-center gap-7 whitespace-nowrap text-[14.5px] font-medium text-ink-500 lg:flex">
              {NAV.map(([label, href]) => (
                <a key={href} href={href} className="hover:text-ink-800">
                  {label}
                </a>
              ))}
            </nav>
            <ButtonLink href="/estudio" variant="accent" size="md" className="shrink-0">
              Analizar mi vivienda
            </ButtonLink>
          </>
        ) : (
          <LanguageSwitcher current={lang} basePath={basePath} />
        )}
      </div>
    </header>
  );
}
