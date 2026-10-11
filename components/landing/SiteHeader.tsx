import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";
import { PROPERTY_GROUPS, type PropertyGroup } from "@/services/listings/catalog";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu, type MenuGroup } from "./MobileMenu";

/** Tipos de los submenús VENTA y ALQUILER (amarres incluidos, con su búsqueda propia). */
const GROUPS = (Object.keys(PROPERTY_GROUPS) as PropertyGroup[]).filter((g) => g !== "otros");
const groupHref = (op: "SALE" | "RENT", g: PropertyGroup) =>
  g === "amarres" ? (op === "RENT" ? "/amarres/alquilar" : "/amarres/comprar") : `${op === "RENT" ? "/alquilar" : "/comprar"}/${g}`;
const MENUS: MenuGroup[] = (
  [
    ["Venta", "SALE", "/comprar", "Ver todo en venta"],
    ["Alquiler", "RENT", "/alquilar", "Ver todo en alquiler"],
  ] as const
).map(([label, op, href, all]) => ({ label, all: { label: all, href }, items: GROUPS.map((g) => ({ label: PROPERTY_GROUPS[g].label, href: groupHref(op, g) })) }));
const LINKS = [
  { label: "Valorar vivienda", href: "/estudio" },
  { label: "Contacto", href: "/contacto" },
];
const CTA = { label: "Publica tu inmueble gratis", href: "/publicar" };

const navLink = "rounded-md px-1 py-1 hover:text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-500";

/**
 * Cabecera de FINCALIA360: INICIO · VENTA ▾ · ALQUILER ▾ · VALORAR VIVIENDA · CONTACTO, y el botón
 * destacado «Publica tu inmueble gratis». `showNav = false` se usa en las páginas de resultado de las
 * solicitudes antiguas, que siguen siendo multilingües (muestran el selector de idioma).
 */
export function SiteHeader({ dict, lang, basePath = "/", showNav = true }: { dict: Dictionary; lang: Language; basePath?: string; showNav?: boolean }) {
  void dict;
  return (
    <header className="sticky top-0 z-30 border-b border-sand-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-2 sm:h-[72px] sm:gap-4">
        <Link href="/" aria-label="FINCALIA360 · inicio" className="shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-terracotta-500">
          <Logo />
        </Link>
        {showNav ? (
          <>
            <nav aria-label="Principal" className="hidden items-center gap-4 whitespace-nowrap text-[14.5px] font-medium text-ink-600 lg:flex xl:gap-6">
              <Link href="/" className={navLink}>
                Inicio
              </Link>
              {/* Venta y Alquiler: submenú con los tipos de inmueble (ratón o teclado) */}
              {MENUS.map((m) => (
                <div key={m.label} className="group relative">
                  <Link href={m.all.href} className={`inline-flex items-center gap-1 ${navLink}`} aria-haspopup="true">
                    {m.label} <span aria-hidden className="text-[10px] text-ink-400">▾</span>
                  </Link>
                  <div className="invisible absolute left-1/2 top-full z-40 -translate-x-1/2 pt-3 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <div className="w-64 rounded-2xl border border-sand-200 bg-white p-2 shadow-xl">
                      {m.items.map((i) => (
                        <Link key={i.href} href={i.href} className="block rounded-lg px-3 py-2 text-ink-700 hover:bg-sand-50 focus-visible:bg-sand-50 focus-visible:outline-none">
                          {i.label}
                        </Link>
                      ))}
                      <Link href={m.all.href} className="mt-1 block rounded-lg border-t border-sand-100 px-3 py-2 font-semibold text-ink-800 hover:bg-sand-50 focus-visible:bg-sand-50 focus-visible:outline-none">
                        {m.all.label}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} className={navLink}>
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              {/* Llamada principal: publicar gratis */}
              <Link
                href={CTA.href}
                className="inline-flex h-10 shrink-0 items-center rounded-full bg-terracotta-500 px-4 text-[13.5px] font-semibold text-white transition hover:bg-terracotta-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-500 sm:text-sm"
              >
                <span className="sm:hidden">Publicar gratis</span>
                <span className="hidden sm:inline">{CTA.label}</span>
              </Link>
              <MobileMenu groups={MENUS} links={LINKS} cta={CTA} />
            </div>
          </>
        ) : (
          <LanguageSwitcher current={lang} basePath={basePath} />
        )}
      </div>
    </header>
  );
}
