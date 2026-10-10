// Página de resultados compartida por /comprar, /alquilar, /amarres/comprar y /amarres/alquilar.
// Los filtros son un formulario GET: la búsqueda queda en la URL (se puede compartir) y funciona sin JavaScript.
import Link from "next/link";
import { SlidersHorizontal, Home, Anchor, X } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";
import { FEATURES, MOORING_FEATURES, MOORING_TYPES, PROPERTY_TYPES } from "@/services/listings/catalog";
import { searchPublic, type SearchFilters } from "@/services/listings/listings";
import { portalLocations } from "@/services/listings/portalLocations";
import { ListingCard } from "./ListingCard";
import { AutoSubmit } from "./AutoSubmit";
import { LocationFilter } from "./LocationFilter";

type Category = "HOME" | "MOORING";

const PRICE_STEPS: Record<Category, Record<"SALE" | "RENT", number[]>> = {
  HOME: {
    SALE: [50000, 100000, 150000, 200000, 250000, 300000, 400000, 500000, 750000, 1000000, 1500000],
    RENT: [400, 500, 600, 700, 800, 1000, 1200, 1500, 2000, 2500, 3000],
  },
  MOORING: {
    SALE: [10000, 20000, 30000, 50000, 75000, 100000, 150000, 200000, 300000, 500000],
    RENT: [100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000],
  },
};

/** Características que se ofrecen como filtro (las más buscadas). */
const HOME_FILTER_FEATURES = ["ELEVATOR", "TERRACE", "PARKING", "POOL", "GARDEN", "AC", "STORAGE", "FURNISHED", "EXTERIOR", "ACCESSIBLE", "PETS"] as const;
const MOORING_FILTER_FEATURES = ["WATER", "ELECTRICITY", "SECURITY", "PARKING_CAR", "WIFI", "SHOWERS", "FUEL", "TRAVEL_LIFT"] as const;

function eur(n: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(n) + " €";
}

function qs(f: SearchFilters, over: Partial<SearchFilters>) {
  const merged = { ...f, ...over };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "car") for (const c of String(v).split(",")) p.append("car", c);
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function paths(category: Category) {
  return category === "MOORING" ? { SALE: "/amarres/comprar", RENT: "/amarres/alquilar" } : { SALE: "/comprar", RENT: "/alquilar" };
}

export async function PortalSearchPage({ operation, filters, category = "HOME" }: { operation: "SALE" | "RENT"; filters: SearchFilters; category?: Category }) {
  const dict = getDictionary("es");
  const mooring = category === "MOORING";
  const [result, locations] = await Promise.all([searchPublic(operation, filters, category), portalLocations(operation, category)]);
  const rent = operation === "RENT";
  const base = paths(category)[operation];
  const anyFilter = Object.keys(filters).some((k) => k !== "pagina" && k !== "orden");
  const provinceName = locations.provinces.find((p) => p.code === filters.provincia)?.name;
  const place = filters.puerto ?? filters.municipio ?? (provinceName ? `la provincia de ${provinceName}` : "Cataluña");
  const noun = (n: number) =>
    mooring
      ? `${n.toLocaleString("es-ES")} ${n === 1 ? "amarre" : "amarres"} en ${rent ? "alquiler" : "venta"} en ${place}`
      : `${n.toLocaleString("es-ES")} ${n === 1 ? "vivienda" : "viviendas"} en ${rent ? "alquiler" : "venta"} en ${place}`;
  const selectedFeatures = new Set(filters.car ? filters.car.split(",") : []);
  const featureLabels: Record<string, string> = { ...FEATURES, ...MOORING_FEATURES };
  const meters = (v: number) => `${v.toLocaleString("es-ES")} m`;

  // Filtros activos, cada uno con su enlace para quitarlo
  const chips: Array<{ label: string; remove: Partial<SearchFilters> }> = [
    ...(provinceName ? [{ label: provinceName, remove: { provincia: undefined, municipio: undefined } }] : []),
    ...(filters.municipio ? [{ label: filters.municipio, remove: { municipio: undefined } }] : []),
    ...(filters.puerto ? [{ label: filters.puerto, remove: { puerto: undefined } }] : []),
    ...(filters.zona ? [{ label: filters.zona, remove: { zona: undefined } }] : []),
    ...(filters.tipo ? [{ label: PROPERTY_TYPES[filters.tipo as keyof typeof PROPERTY_TYPES] ?? filters.tipo, remove: { tipo: undefined } }] : []),
    ...(filters.tipoAmarre ? [{ label: MOORING_TYPES[filters.tipoAmarre], remove: { tipoAmarre: undefined } }] : []),
    ...(filters.min ? [{ label: `Desde ${eur(filters.min)}`, remove: { min: undefined } }] : []),
    ...(filters.max ? [{ label: `Hasta ${eur(filters.max)}`, remove: { max: undefined } }] : []),
    ...(filters.hab ? [{ label: `${filters.hab}+ hab.`, remove: { hab: undefined } }] : []),
    ...(filters.banos ? [{ label: `${filters.banos}+ ${filters.banos === 1 ? "baño" : "baños"}`, remove: { banos: undefined } }] : []),
    ...(filters.m2 ? [{ label: `Desde ${filters.m2} m²`, remove: { m2: undefined } }] : []),
    ...(filters.eslora ? [{ label: `Eslora ${meters(filters.eslora)}`, remove: { eslora: undefined } }] : []),
    ...(filters.manga ? [{ label: `Manga ${meters(filters.manga)}`, remove: { manga: undefined } }] : []),
    ...[...selectedFeatures].map((c) => ({
      label: featureLabels[c] ?? c,
      remove: { car: [...selectedFeatures].filter((x) => x !== c).join(",") || undefined },
    })),
  ];

  const title = mooring ? (rent ? "Amarres en alquiler" : "Amarres en venta") : rent ? "Viviendas en alquiler en Cataluña" : "Viviendas en venta en Cataluña";
  const intro = mooring
    ? `Amarres ${rent ? "en alquiler" : "en venta"} en puertos deportivos de Cataluña. Cada anuncio se revisa antes de publicarse.`
    : `Inmuebles ${rent ? "en alquiler" : "en venta"} en Barcelona, Girona, Lleida y Tarragona, publicados por FINCALIA360 y por inmobiliarias colaboradoras. Cada anuncio se revisa antes de publicarse.`;
  const featureOptions = mooring ? MOORING_FILTER_FEATURES : HOME_FILTER_FEATURES;

  return (
    <div lang="es">
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="bg-sand-50">
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page py-6 sm:py-10">
            <p className="eyebrow">{mooring ? (rent ? "Alquilar amarre" : "Comprar amarre") : rent ? "Alquilar" : "Comprar"}</p>
            <h1 className="mt-3 font-serif text-[34px] font-medium leading-tight tracking-tight text-ink-800 sm:text-5xl">{title}</h1>
            <p className="mt-3 hidden max-w-2xl text-[15.5px] text-ink-500 sm:block">{intro}</p>
          </div>
        </section>

        <div className="container-page grid gap-8 py-8 lg:grid-cols-[280px_1fr]">
          <aside>
            <div className="rounded-2xl border border-sand-200 bg-white lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              {/* En móvil los filtros se despliegan con este interruptor (sin JavaScript) */}
              <input type="checkbox" id="ver-filtros" className="peer sr-only" />
              <label htmlFor="ver-filtros" className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-ink-800 lg:hidden">
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" /> {chips.length ? `Filtros (${chips.length})` : "Filtrar búsqueda"}
                </span>
                <span className="text-ink-400">▾</span>
              </label>
              <form method="get" action={base} className="hidden space-y-4 border-t border-sand-100 p-4 peer-checked:block lg:block lg:border-t-0">
                <p className="hidden text-sm font-semibold text-ink-800 lg:flex lg:items-center lg:gap-2">
                  <SlidersHorizontal className="h-4 w-4" /> Filtros
                </p>
                <div className="grid grid-cols-2 gap-2 rounded-full bg-sand-100 p-1 text-center text-sm font-medium">
                  <Link href={paths(category).SALE} className={rent ? "rounded-full py-1.5 text-ink-500" : "rounded-full bg-white py-1.5 text-ink-800 shadow-sm"}>
                    Comprar
                  </Link>
                  <Link href={paths(category).RENT} className={rent ? "rounded-full bg-white py-1.5 text-ink-800 shadow-sm" : "rounded-full py-1.5 text-ink-500"}>
                    Alquilar
                  </Link>
                </div>
                <LocationFilter locations={locations} province={filters.provincia} municipality={filters.municipio} />
                {mooring ? (
                  <>
                    <label className="block">
                      <span className="field-label">Puerto</span>
                      <select name="puerto" defaultValue={filters.puerto ?? ""} className="field">
                        <option value="">Todos los puertos</option>
                        {locations.ports.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} ({p.count})
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="field-label">Eslora de tu barco</span>
                        <select name="eslora" defaultValue={filters.eslora ?? ""} className="field px-2">
                          <option value="">Cualquiera</option>
                          {[6, 8, 10, 12, 15, 18, 20, 25, 30, 40].map((n) => (
                            <option key={n} value={n}>
                              {n} m
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="field-label">Manga</span>
                        <select name="manga" defaultValue={filters.manga ?? ""} className="field px-2">
                          <option value="">Cualquiera</option>
                          {[2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8].map((n) => (
                            <option key={n} value={n}>
                              {n.toLocaleString("es-ES")} m
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block">
                      <span className="field-label">Tipo de amarre</span>
                      <select name="tipoAmarre" defaultValue={filters.tipoAmarre ?? ""} className="field">
                        <option value="">Todos</option>
                        {Object.entries(MOORING_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className="field-label">Zona o barrio</span>
                      <input name="zona" defaultValue={filters.zona ?? ""} placeholder="Cualquiera" className="field" maxLength={80} />
                    </label>
                    <label className="block">
                      <span className="field-label">Tipo de inmueble</span>
                      <select name="tipo" defaultValue={filters.tipo ?? ""} className="field">
                        <option value="">Todos</option>
                        {Object.entries(PROPERTY_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="field-label">Precio mín.</span>
                    <select name="min" defaultValue={filters.min ?? ""} className="field px-2">
                      <option value="">Sin mínimo</option>
                      {PRICE_STEPS[category][operation].map((v) => (
                        <option key={v} value={v}>
                          {eur(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Precio máx.</span>
                    <select name="max" defaultValue={filters.max ?? ""} className="field px-2">
                      <option value="">Sin máximo</option>
                      {PRICE_STEPS[category][operation].map((v) => (
                        <option key={v} value={v}>
                          {eur(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {!mooring && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="field-label">Habitaciones</span>
                        <select name="hab" defaultValue={filters.hab ?? ""} className="field px-2">
                          <option value="">Todas</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} o más
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="field-label">Baños</span>
                        <select name="banos" defaultValue={filters.banos ?? ""} className="field px-2">
                          <option value="">Todos</option>
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {n} o más
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block">
                      <span className="field-label">Superficie</span>
                      <select name="m2" defaultValue={filters.m2 ?? ""} className="field">
                        <option value="">Toda</option>
                        {[40, 60, 80, 100, 120, 150, 200, 300].map((n) => (
                          <option key={n} value={n}>
                            Desde {n} m²
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                <fieldset>
                  <legend className="field-label">{mooring ? "Servicios" : "Características"}</legend>
                  <div className="grid grid-cols-1 gap-1.5">
                    {featureOptions.map((code) => (
                      <label key={code} className="flex items-center gap-2 text-[13.5px] text-ink-700">
                        <input type="checkbox" name="car" value={code} defaultChecked={selectedFeatures.has(code)} className="h-4 w-4 rounded border-sand-300" />
                        {featureLabels[code]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {filters.orden && <input type="hidden" name="orden" value={filters.orden} />}
                <AutoSubmit />
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="h-10 flex-1 rounded-full bg-ink-800 text-sm font-medium text-white hover:bg-ink-700">
                    Buscar
                  </button>
                  {anyFilter && (
                    <Link href={base} className="flex h-10 items-center rounded-full border border-sand-300 px-4 text-sm text-ink-600 hover:bg-sand-50">
                      Limpiar
                    </Link>
                  )}
                </div>
              </form>
            </div>
          </aside>

          <section aria-label="Resultados" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink-800">{noun(result.total)}</h2>
              {result.total > 1 && (
                <nav aria-label="Ordenar" className="flex gap-1 text-[13px]">
                  {(
                    [
                      ["recientes", "Más recientes"],
                      ["precio-asc", "Más baratos"],
                      ["precio-desc", "Más caros"],
                    ] as const
                  ).map(([k, label]) => (
                    <Link
                      key={k}
                      href={`${base}${qs(filters, { orden: k === "recientes" ? undefined : k, pagina: undefined })}`}
                      className={(filters.orden ?? "recientes") === k ? "rounded-full bg-ink-800 px-3 py-1 text-white" : "rounded-full px-3 py-1 text-ink-500 hover:bg-white"}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
              )}
            </div>

            {chips.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {chips.map((c, i) => (
                  <Link
                    key={`${i}-${c.label}`}
                    href={`${base}${qs(filters, { ...c.remove, pagina: undefined })}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sand-300 bg-white px-3 py-1 text-[13px] text-ink-700 hover:border-ink-300"
                    aria-label={`Quitar filtro ${c.label}`}
                  >
                    {c.label} <X className="h-3.5 w-3.5 text-ink-400" />
                  </Link>
                ))}
                <Link href={base} className="px-1 text-[13px] text-ink-500 underline-offset-2 hover:underline">
                  Quitar todos
                </Link>
              </div>
            )}

            {result.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
                {mooring ? <Anchor className="mx-auto h-9 w-9 text-ink-200" /> : <Home className="mx-auto h-9 w-9 text-ink-200" />}
                <h2 className="mt-4 text-lg font-semibold text-ink-800">
                  {anyFilter ? (mooring ? "No hay amarres con estos filtros" : "No hay inmuebles con estos filtros") : mooring ? "Todavía no hay amarres publicados" : "Todavía no hay inmuebles publicados"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
                  {anyFilter
                    ? "Prueba a ampliar la búsqueda o quitar algún filtro."
                    : mooring
                      ? `Muy pronto encontrarás aquí amarres ${rent ? "en alquiler" : "en venta"}. ¿Tienes uno? Publícalo gratis.`
                      : rent
                        ? "Muy pronto encontrarás aquí viviendas en alquiler revisadas. Si eres propietario, publica la tuya gratis."
                        : "Muy pronto encontrarás aquí viviendas en venta revisadas. Si eres propietario, publica la tuya gratis."}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {anyFilter && (
                    <ButtonLink href={base} variant="outline">
                      Ver todos
                    </ButtonLink>
                  )}
                  <ButtonLink href={mooring ? "/publicar?tipo=amarre" : "/publicar"} variant="accent">
                    {mooring ? "Publica tu amarre gratis" : "Publica tu vivienda gratis"}
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((l) => (
                  <ListingCard key={l.reference} l={l} />
                ))}
              </div>
            )}

            {result.pages > 1 && (
              <nav aria-label="Páginas" className="mt-8 flex items-center justify-center gap-2 text-sm">
                {result.page > 1 && (
                  <Link href={`${base}${qs(filters, { pagina: result.page - 1 === 1 ? undefined : result.page - 1 })}`} className="rounded-full border border-sand-300 bg-white px-4 py-2 hover:bg-sand-50">
                    ← Anterior
                  </Link>
                )}
                <span className="px-3 text-ink-500">
                  Página {result.page} de {result.pages}
                </span>
                {result.page < result.pages && (
                  <Link href={`${base}${qs(filters, { pagina: result.page + 1 })}`} className="rounded-full border border-sand-300 bg-white px-4 py-2 hover:bg-sand-50">
                    Siguiente →
                  </Link>
                )}
              </nav>
            )}

            <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-sand-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink-800">{mooring ? "¿Tienes un amarre para vender o alquilar?" : "¿Quieres vender o alquilar tu vivienda?"}</p>
                <p className="text-sm text-ink-500">Envíanos los datos y las fotos: revisamos tu anuncio y lo publicamos sin coste.</p>
              </div>
              <ButtonLink href={mooring ? "/publicar?tipo=amarre" : "/publicar"} variant="accent" className="shrink-0">
                {mooring ? "Publica tu amarre gratis" : "Publica tu vivienda gratis"}
              </ButtonLink>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-ink-400">
              Los anuncios los publican FINCALIA360 o el anunciante indicado en cada ficha, que responde de sus datos. Los precios son los fijados por el anunciante.
              La ubicación que se muestra es aproximada.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
