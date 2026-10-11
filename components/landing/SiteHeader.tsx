import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";
import { PROPERTY_GROUPS, type PropertyGroup } from "@/services/listings/catalog";
import { LanguageSwitcher } from "./LanguageSwitcher";

/** Tipos de los submenús VENTA y ALQUILER (amarres incluidos, con su búsqueda propia). */
const GROUPS = Object.keys(PROPERTY_GROUPS) as PropertyGroup[];
const groupHref = (op: "SALE" | "RENT", g: PropertyGroup) =>
  g === "amarres" ? (op === "RENT" ? "/amarres/alquilar" : "/amarres/comprar") : `${op === "RENT" ? "/alquilar" : "/comprar"}/${g}`;
const MENUS = [
  { label: "Venta", op: "SALE", all: "/comprar" },
  { label: "Alquiler", op: "RENT", all: "/alquilar" },
] as const;

/**
 * Cabecera de FINCALIA360: INICIO · VENTA ▾ · ALQUILER ▾ · VALORAR VIVIENDA · PUBLICA TU VIVIENDA GRATIS · CONTACTO.
 * `showNav = false` se usa en las páginas de resultado de las solicitudes antiguas, que siguen siendo
 * multilingües (muestran el selector de idioma).
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
            <nav aria-label="Principal" className="hidden items-center gap-3.5 whitespace-nowrap text-[13.5px] font-medium text-ink-500 lg:flex xl:gap-5 xl:text-[14.5px]">
              <Link href="/" className="hover:text-ink-800">
                Inicio
              </Link>
              {/* Venta y Alquiler: submenú con los tipos de inmueble (ratón o teclado) */}
              {MENUS.map((m) => (
                <div key={m.op} className="group relative">
                  <Link href={m.all} className="inline-flex items-center gap-1 hover:text-ink-800" aria-haspopup="true">
                    {m.label} <span aria-hidden className="text-[10px]">▾</span>
                  </Link>
                  <div className="invisible absolute left-1/2 top-full z-40 -translate-x-1/2 pt-3 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <div className="w-64 rounded-2xl border border-sand-200 bg-white p-2 shadow-xl">
                      {GROUPS.map((g) => (
                        <Link key={g} href={groupHref(m.op, g)} className="block rounded-lg px-3 py-2 text-ink-700 hover:bg-sand-50">
                          {PROPERTY_GROUPS[g].label}
                        </Link>
                      ))}
                      <Link href={m.all} className="mt-1 block rounded-lg border-t border-sand-100 px-3 py-2 font-semibold text-ink-800 hover:bg-sand-50">
                        Ver todo {m.op === "RENT" ? "en alquiler" : "en venta"}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              <Link href="/estudio" className="hover:text-ink-800">
                Valorar vivienda
              </Link>
              <Link href="/publicar" className="rounded-full border border-sand-300 px-3 py-1.5 text-ink-700 hover:border-ink-300 hover:text-ink-800">
                <span className="xl:hidden">Publica gratis</span>
                <span className="hidden xl:inline">Publica tu vivienda gratis</span>
              </Link>
              <Link href="/contacto" className="hover:text-ink-800">
                Contacto
              </Link>
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
                <nav aria-label="Principal" className="absolute right-0 top-12 z-40 max-h-[80vh] w-72 overflow-y-auto rounded-2xl border border-sand-200 bg-white p-2 shadow-xl">
                  <Link href="/" className="block rounded-lg px-3 py-2.5 text-[15px] text-ink-700 hover:bg-sand-50">
                    Inicio
                  </Link>
                  {MENUS.map((m) => (
                    <details key={m.op} className="group/sub">
                      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2.5 text-[15px] text-ink-700 hover:bg-sand-50 [&::-webkit-details-marker]:hidden">
                        {m.label} <span aria-hidden className="text-ink-400 transition group-open/sub:rotate-180">▾</span>
                      </summary>
                      <div className="mb-1 ml-3 border-l border-sand-200 pl-2">
                        {GROUPS.map((g) => (
                          <Link key={g} href={groupHref(m.op, g)} className="block rounded-lg px-3 py-2 text-[14px] text-ink-600 hover:bg-sand-50">
                            {PROPERTY_GROUPS[g].label}
                          </Link>
                        ))}
                        <Link href={m.all} className="block rounded-lg px-3 py-2 text-[14px] font-semibold text-ink-800 hover:bg-sand-50">
                          Ver todo
                        </Link>
                      </div>
                    </details>
                  ))}
                  {(
                    [
                      ["Valorar vivienda", "/estudio"],
                      ["Publica tu vivienda gratis", "/publicar"],
                      ["Contacto", "/contacto"],
                    ] as const
                  ).map(([label, href]) => (
                    <Link key={href} href={href} className="block rounded-lg px-3 py-2.5 text-[15px] text-ink-700 hover:bg-sand-50">
                      {label}
                    </Link>
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
