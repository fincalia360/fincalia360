// Portada del portal inmobiliario (va antes de la sección de valoración, que no se modifica):
// 1) presentación con el buscador, 2) Venta y Alquiler, 3) categorías, 4) publicar gratis,
// y la cabecera que separa la valoración como servicio independiente.
import Link from "next/link";
import { Anchor, ArrowRight, Briefcase, Building2, Car, Home, KeyRound, LandPlot, Megaphone, Store, Tag } from "lucide-react";
import { PROPERTY_GROUPS, type PropertyGroup } from "@/services/listings/catalog";
import { publicVisibility } from "@/services/listings/listings";
import { citiesWithListings, groupPath } from "@/services/listings/seo";
import { prisma } from "@/db/client";
import { HomeSearch } from "./HomeSearch";

const CATEGORIES: Array<{ group: PropertyGroup; icon: typeof Home }> = [
  { group: "pisos", icon: Building2 },
  { group: "casas", icon: Home },
  { group: "locales", icon: Store },
  { group: "oficinas", icon: Briefcase },
  { group: "garajes", icon: Car },
  { group: "terrenos", icon: LandPlot },
  { group: "amarres", icon: Anchor },
];

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-500";

async function portalNumbers() {
  try {
    const [sale, rent, saleCities, rentCities, saleMoorings, rentMoorings] = await Promise.all([
      prisma.listing.count({ where: { ...publicVisibility(), operation: "SALE" } }),
      prisma.listing.count({ where: { ...publicVisibility(), operation: "RENT" } }),
      citiesWithListings("HOME", "SALE"),
      citiesWithListings("HOME", "RENT"),
      citiesWithListings("MOORING", "SALE"),
      citiesWithListings("MOORING", "RENT"),
    ]);
    const cities = [...new Set([...saleCities, ...rentCities, ...saleMoorings, ...rentMoorings].map((c) => c.name))].sort((a, b) => a.localeCompare(b, "es"));
    return { sale, rent, cities };
  } catch {
    return { sale: 0, rent: 0, cities: [] as string[] };
  }
}

export async function PortalHome() {
  const { sale, rent, cities } = await portalNumbers();
  const count = (n: number) => (n ? `${n.toLocaleString("es-ES")} ${n === 1 ? "anuncio" : "anuncios"}` : null);

  return (
    <>
      {/* 1. Presentación del portal y buscador principal */}
      <section aria-labelledby="portal-titulo" className="border-b border-sand-200 bg-gradient-to-b from-white to-sand-50 pb-12 pt-10 sm:pb-16 sm:pt-14">
        <div className="container-page">
          <p className="eyebrow">Portal inmobiliario en Cataluña</p>
          <h1 id="portal-titulo" className="mt-3 max-w-3xl text-[34px] font-extrabold leading-[1.08] tracking-tight text-ink-800 sm:text-5xl">
            Encuentra tu próximo inmueble en Cataluña
          </h1>
          <p className="mt-4 max-w-2xl text-[16.5px] text-ink-500 sm:text-lg">Pisos, casas, locales, oficinas, garajes, terrenos y amarres en venta y en alquiler.</p>
          <div className="mt-7 sm:mt-8">
            <HomeSearch cities={cities} />
          </div>
        </div>
      </section>

      {/* 2. Venta y Alquiler */}
      <section aria-label="Venta y alquiler" className="py-10 sm:py-14">
        <div className="container-page grid gap-4 md:grid-cols-2">
          {(
            [
              { href: "/comprar", icon: Tag, title: "Inmuebles en venta", text: "Para comprar tu vivienda, un local, una oficina, una plaza de garaje, un terreno o un amarre.", cta: "Ver inmuebles en venta", n: sale },
              { href: "/alquilar", icon: KeyRound, title: "Inmuebles en alquiler", text: "Viviendas, locales, oficinas, garajes y amarres para alquilar por meses o por temporadas.", cta: "Ver inmuebles en alquiler", n: rent },
            ] as const
          ).map(({ href, icon: Icon, title, text, cta, n }) => (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col rounded-3xl border border-sand-200 bg-white p-6 transition hover:border-ink-200 hover:shadow-soft sm:p-7 ${focus}`}
            >
              <span className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-800 text-white">
                  <Icon className="h-6 w-6" />
                </span>
                {count(n) && <span className="rounded-full bg-sand-100 px-3 py-1 text-[13px] font-medium text-ink-600">{count(n)}</span>}
              </span>
              <span className="mt-5 text-2xl font-extrabold tracking-tight text-ink-800">{title}</span>
              <span className="mt-2 text-[15px] leading-relaxed text-ink-500">{text}</span>
              <span className="mt-5 inline-flex items-center gap-2 font-semibold text-terracotta-700">
                {cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Categorías */}
      <section aria-labelledby="categorias-titulo" className="pb-10 sm:pb-14">
        <div className="container-page">
          <h2 id="categorias-titulo" className="text-2xl font-extrabold tracking-tight text-ink-800 sm:text-3xl">
            ¿Qué tipo de inmueble buscas?
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {CATEGORIES.map(({ group, icon: Icon }) => (
              <li key={group} className="flex flex-col rounded-2xl border border-sand-200 bg-white p-4 transition hover:border-ink-200 hover:shadow-soft">
                <Link href={groupPath("SALE", group)} className={`flex flex-1 flex-col gap-3 rounded-lg ${focus}`}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-terracotta-50 text-terracotta-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[15px] font-bold leading-snug text-ink-800">{PROPERTY_GROUPS[group].label}</span>
                </Link>
                <span className="mt-3 flex gap-3 border-t border-sand-100 pt-3 text-[13px] font-medium">
                  <Link href={groupPath("SALE", group)} className={`rounded text-ink-600 hover:text-ink-800 hover:underline ${focus}`}>
                    Venta
                  </Link>
                  <Link href={groupPath("RENT", group)} className={`rounded text-ink-600 hover:text-ink-800 hover:underline ${focus}`}>
                    Alquiler
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Publicar gratis */}
      <section aria-label="Publica tu inmueble gratis" className="pb-12 sm:pb-16">
        <div className="container-page">
          <div className="flex flex-col gap-5 rounded-3xl bg-ink-800 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div className="flex items-start gap-4">
              <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-terracotta-500 sm:grid">
                <Megaphone className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">¿Quieres vender o alquilar? Publica tu inmueble gratis</h2>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-100">
                  Pisos, casas, locales, oficinas, garajes, terrenos o amarres en Cataluña. Envíanos los datos y las fotos: revisamos tu anuncio y lo publicamos sin coste.
                </p>
              </div>
            </div>
            <Link
              href="/publicar"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-terracotta-500 px-6 font-semibold text-white transition hover:bg-terracotta-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Publica tu inmueble gratis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/** Separa la valoración como servicio independiente, sin tocar su contenido (que va a continuación). */
export function ValuationIntro() {
  return (
    <div id="valorar" className="scroll-mt-20 border-t-4 border-terracotta-100">
      <div className="container-page flex flex-wrap items-baseline justify-between gap-2 pt-10 sm:pt-12">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink-400">Herramienta gratuita · Valoración de vivienda</p>
        <p className="text-sm text-ink-500">Conoce una estimación de tu vivienda y compara vender, alquilar o mantener.</p>
      </div>
    </div>
  );
}
