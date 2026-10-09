import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function SiteHeader({ dict, lang, basePath = "/", showNav = true }: { dict: Dictionary; lang: Language; basePath?: string; showNav?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-sand-200/70 bg-sand-50/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href={`/?lang=${lang}`} aria-label="Tramontana" className="shrink-0">
          <Logo tagline={dict.brand.tagline} />
        </Link>
        {showNav && (
          <nav className="hidden items-center gap-6 whitespace-nowrap text-sm text-ink-500 xl:flex">
            <a href={`/?lang=${lang}#como-funciona`} className="hover:text-ink-800">{dict.nav.how}</a>
            <a href={`/?lang=${lang}#zonas`} className="hover:text-ink-800">{dict.nav.zones}</a>
            <a href={`/?lang=${lang}#extranjero`} className="hover:text-ink-800">{dict.nav.abroad}</a>
            <Link href="/estudio" className="font-medium text-terracotta-600 hover:text-terracotta-700">{dict.nav.study}</Link>
          </nav>
        )}
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/estudio" className="text-right text-[12px] font-medium leading-tight text-terracotta-600 sm:hidden">
            {dict.nav.study}
          </Link>
          <div className="hidden sm:block">
            <LanguageSwitcher current={lang} basePath={basePath} />
          </div>
          {showNav && (
            <ButtonLink href={`/valorar?lang=${lang}`} size="sm" className="hidden md:inline-flex">
              {dict.nav.cta}
            </ButtonLink>
          )}
        </div>
      </div>
      <div className="container-page pb-2 sm:hidden">
        <LanguageSwitcher current={lang} basePath={basePath} />
      </div>
      <div className="container-page hidden pb-2 sm:block xl:hidden">
        <Link href="/estudio" className="text-[13px] font-medium text-terracotta-600">{dict.nav.study} →</Link>
      </div>
    </header>
  );
}
