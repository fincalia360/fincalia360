import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";
import { PROPERTY_GROUPS, type PropertyGroup } from "@/services/listings/catalog";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { portalDict } from "@/lib/i18n/site";
import { LanguageMenu } from "./LanguageMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu, type MenuGroup } from "./MobileMenu";

/** Tipos de los submenús VENTA y ALQUILER (amarres incluidos, con su búsqueda propia). */
const GROUPS = (Object.keys(PROPERTY_GROUPS) as PropertyGroup[]).filter((g) => g !== "otros");
const groupHref = (op: "SALE" | "RENT", g: PropertyGroup) =>
  g === "amarres" ? (op === "RENT" ? "/amarres/alquilar" : "/amarres/comprar") : `${op === "RENT" ? "/alquilar" : "/comprar"}/${g}`;

const navLink = "rounded-md px-1 py-1 hover:text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-500";

/**
 * Cabecera de FINCALIA360: INICIO · VENTA ▾ · ALQUILER ▾ · VALORAR VIVIENDA · CONTACTO, y el botón
 * destacado «Publica tu inmueble gratis». `showNav = false` se usa en las páginas de resultado de las
 * solicitudes antiguas, que siguen siendo multilingües (muestran el selector de idioma).
 */
export async function SiteHeader({ dict, lang, basePath = "/", showNav = true }: { dict: Dictionary; lang: Language; basePath?: string; showNav?: boolean }) {
  void dict;
  void PROPERTY_GROUPS;
  const siteLang = await getSiteLang();
  const d = portalDict(siteLang);
  const MENUS: MenuGroup[] = (
    [
      [d.nav.sale, "SALE", "/comprar", d.nav.allSale],
      [d.nav.rent, "RENT", "/alquilar", d.nav.allRent],
    ] as const
  ).map(([label, op, href, all]) => ({ label, all: { label: all, href }, items: GROUPS.map((g) => ({ label: d.groups[g], href: groupHref(op, g) })) }));
  const LINKS = [
    { label: d.nav.transfers, href: "/traspasos" },
    { label: d.nav.searching, href: "/busco-piso" },
    { label: d.nav.valuate, href: "/estudio" },
    { label: d.nav.contact, href: "/contacto" },
  ];
  const CTA = { label: d.nav.publish, href: "/publicar" };
  return (
    <header className="sticky top-0 z-30 border-b border-sand-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-2 sm:h-[72px] sm:gap-4">
        <Link href="/" aria-label="FINCALIA360 · inicio" className="shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-terracotta-500">
          <Logo />
        </Link>
        {showNav ? (
          <>
            <nav aria-label={d.nav.main} className="hidden items-center gap-3.5 whitespace-nowrap text-[14.5px] font-medium text-ink-600 xl:flex">
              {/* Menú completo desde 1280 px; por debajo, el botón de menú (con todas las opciones) */}
              <Link href="/" className={navLink}>
                {d.nav.home}
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
                                {/* Con el menú completo (desde 1280 px) el botón usa el texto corto para que quepa */}
                <span className="sm:hidden xl:inline">{d.nav.publishShort}</span>
                <span className="hidden sm:inline xl:hidden">{CTA.label}</span>
              </Link>
              <LanguageMenu current={siteLang} label={d.nav.language} />
              <MobileMenu groups={MENUS} links={LINKS} cta={CTA} labels={{ home: d.nav.home, open: d.nav.openMenu, close: d.nav.closeMenu, main: d.nav.main }} />
            </div>
          </>
        ) : (
          <LanguageSwitcher current={lang} basePath={basePath} />
        )}
      </div>
    </header>
  );
}
