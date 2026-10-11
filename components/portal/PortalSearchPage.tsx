// Página de resultados compartida por /comprar, /alquilar, /amarres/comprar y /amarres/alquilar.
// Los filtros son un formulario GET: la búsqueda queda en la URL (se puede compartir) y funciona sin JavaScript.
import Link from "next/link";
import { SlidersHorizontal, Home, Anchor, X } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";
import {
  COMMERCIAL_FEATURES,
  GARAGE_FEATURES,
  HOME_SEARCH_GROUPS,
  LAND_FEATURES,
  PROPERTY_GROUPS,
  type FieldKind,
  type PropertyGroup,
} from "@/services/listings/catalog";
import { searchPublic, type SearchFilters } from "@/services/listings/listings";
import { portalLocations } from "@/services/listings/portalLocations";
import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { catalogLabels } from "@/lib/i18n/portal/labels";
import { localizedTexts } from "@/services/listings/translations";
import { breadcrumbJsonLd, cityPath, citiesWithListings, organizationJsonLd } from "@/services/listings/seo";
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
/** Características que se ofrecen como filtro según el tipo de inmueble elegido (ninguna si no se elige tipo). */
const FILTER_FEATURES: Partial<Record<FieldKind, readonly string[]>> = {
  DWELLING: HOME_FILTER_FEATURES,
  COMMERCIAL: Object.keys(COMMERCIAL_FEATURES).slice(0, 10),
  GARAGE: Object.keys(GARAGE_FEATURES),
  LAND: Object.keys(LAND_FEATURES),
  MOORING: MOORING_FILTER_FEATURES,
};


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

export async function PortalSearchPage({
  operation,
  filters,
  category = "HOME",
  city,
}: {
  operation: "SALE" | "RENT";
  filters: SearchFilters;
  category?: Category;
  /** Página de una población o de un tipo (/comprar/girona, /comprar/pisos…): título, texto y dirección propios */
  city?: { name: string; title: string; description: string; path: string };
}) {
  const dict = getDictionary("es");
  const siteLang = await getSiteLang();
  const d = portalDict(siteLang);
  const r = d.results;
  const L = catalogLabels(siteLang);
  const eur = (n: number) => new Intl.NumberFormat(d.locale, { maximumFractionDigits: 0 }).format(n) + " €";
  const mooring = category === "MOORING";
  const [result, locations, cities] = await Promise.all([searchPublic(operation, filters, category), portalLocations(operation, category), citiesWithListings(category, operation)]);
  const rent = operation === "RENT";
  const base = paths(category)[operation];
  const anyFilter = Object.keys(filters).some((k) => k !== "pagina" && k !== "orden");
  const provinceName = locations.provinces.find((p) => p.code === filters.provincia)?.name;
  const place = filters.puerto ?? filters.municipio ?? (provinceName ? r.provinceOf(provinceName) : r.catalonia);
  const noun = (n: number) => r.count(n, mooring ? "mooring" : groupKind === "DWELLING" ? "home" : "property", rent, place);
  const selectedFeatures = new Set(filters.car ? filters.car.split(",") : []);
  const featureLabels: Record<string, string> = L.features;
  const group = !mooring && filters.grupo ? PROPERTY_GROUPS[filters.grupo as PropertyGroup] : null;
  const groupKind: FieldKind | null = mooring ? "MOORING" : (group?.kind ?? null);
  const showRooms = !mooring && (groupKind === null || groupKind === "DWELLING" || groupKind === "OTHER");
  const showSize = !mooring && groupKind !== "GARAGE";
  const meters = (v: number) => `${v.toLocaleString(d.locale)} m`;

  // Filtros activos, cada uno con su enlace para quitarlo
  const chips: Array<{ label: string; remove: Partial<SearchFilters> }> = [
    ...(provinceName ? [{ label: provinceName, remove: { provincia: undefined, municipio: undefined } }] : []),
    ...(filters.municipio ? [{ label: filters.municipio, remove: { municipio: undefined } }] : []),
    ...(filters.puerto ? [{ label: filters.puerto, remove: { puerto: undefined } }] : []),
    ...(filters.zona ? [{ label: filters.zona, remove: { zona: undefined } }] : []),
    ...(group ? [{ label: d.groups[filters.grupo as PropertyGroup], remove: { grupo: undefined, car: undefined, clas: undefined, uso: undefined, estado: undefined } }] : []),
    ...(filters.tipo ? [{ label: L.types[filters.tipo] ?? filters.tipo, remove: { tipo: undefined } }] : []),
    ...(filters.estado ? [{ label: L.conditions[filters.estado], remove: { estado: undefined } }] : []),
    ...(filters.clas ? [{ label: L.landClasses[filters.clas], remove: { clas: undefined } }] : []),
    ...(filters.uso ? [{ label: r.useChip(L.landUses[filters.uso]), remove: { uso: undefined } }] : []),
    ...(filters.disp ? [{ label: r.availableNow, remove: { disp: undefined } }] : []),
    ...(filters.tipoAmarre ? [{ label: L.mooringTypes[filters.tipoAmarre], remove: { tipoAmarre: undefined } }] : []),
    ...(filters.min ? [{ label: r.from(eur(filters.min)), remove: { min: undefined } }] : []),
    ...(filters.max ? [{ label: r.upTo(eur(filters.max) + (rent ? d.search.perMonth : "")), remove: { max: undefined } }] : []),
    ...(filters.hab ? [{ label: r.roomsChip(filters.hab), remove: { hab: undefined } }] : []),
    ...(filters.banos ? [{ label: r.bathsChip(filters.banos), remove: { banos: undefined } }] : []),
    ...(filters.m2 ? [{ label: r.fromM2(filters.m2.toLocaleString(d.locale)), remove: { m2: undefined } }] : []),
    ...(filters.eslora ? [{ label: r.lengthChip(meters(filters.eslora)), remove: { eslora: undefined } }] : []),
    ...(filters.manga ? [{ label: r.beamChip(meters(filters.manga)), remove: { manga: undefined } }] : []),
    ...[...selectedFeatures].map((c) => ({
      label: featureLabels[c] ?? c,
      remove: { car: [...selectedFeatures].filter((x) => x !== c).join(",") || undefined },
    })),
  ];

  const title =
    city?.title ??
    (mooring
      ? rent
        ? r.titleMooringRent
        : r.titleMooringSale
      : group
        ? r.titleGroup(d.groups[filters.grupo as PropertyGroup], rent)
        : rent
          ? r.titleRent
          : r.titleSale);
  const intro = city
    ? city.description
    : mooring
    ? r.introMooring(rent)
    : r.introHome(rent);
  const featureOptions = (groupKind && FILTER_FEATURES[groupKind]) || [];
  const sectionName = mooring ? (rent ? r.crumbMooringRent : r.crumbMooringSale) : rent ? r.eyebrowRent : r.eyebrowSale;
  const crumbs = [
    { name: d.nav.home, path: "/" },
    { name: sectionName, path: base },
    ...(city ? [{ name: city.name, path: city.path }] : []),
  ];
  const jsonLd = [organizationJsonLd(), breadcrumbJsonLd(crumbs)];

  return (
    <div>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="bg-sand-50">
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page py-6 sm:py-10">
            {city && (
              <nav aria-label={r.path} className="mb-3 text-[13px] text-ink-400">
                <Link href={base} className="hover:text-ink-700 hover:underline">
                  {sectionName}
                </Link>{" "}
                › <span className="text-ink-600">{city.name}</span>
              </nav>
            )}
            <p className="eyebrow">{mooring ? (rent ? r.eyebrowMooringRent : r.eyebrowMooringSale) : rent ? r.eyebrowRent : r.eyebrowSale}</p>
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
                  <SlidersHorizontal className="h-4 w-4" /> {chips.length ? r.filtersN(chips.length) : r.filterSearch}
                </span>
                <span className="text-ink-400">▾</span>
              </label>
              <form method="get" action={base} className="hidden space-y-4 border-t border-sand-100 p-4 peer-checked:block lg:block lg:border-t-0">
                <p className="hidden text-sm font-semibold text-ink-800 lg:flex lg:items-center lg:gap-2">
                  <SlidersHorizontal className="h-4 w-4" /> {r.filters}
                </p>
                <div className="grid grid-cols-2 gap-2 rounded-full bg-sand-100 p-1 text-center text-sm font-medium">
                  <Link href={paths(category).SALE} className={rent ? "rounded-full py-1.5 text-ink-500" : "rounded-full bg-white py-1.5 text-ink-800 shadow-sm"}>
                    {r.buy}
                  </Link>
                  <Link href={paths(category).RENT} className={rent ? "rounded-full bg-white py-1.5 text-ink-800 shadow-sm" : "rounded-full py-1.5 text-ink-500"}>
                    {r.rent}
                  </Link>
                </div>
                <LocationFilter
                  locations={locations}
                  province={filters.provincia}
                  municipality={filters.municipio}
                  t={{ province: r.province, allCatalonia: r.allCatalonia, municipality: r.municipality, all: r.allMunicipalities, allCatalonia2: r.allMunicipalitiesCatalonia }}
                />
                {mooring ? (
                  <>
                    <label className="block">
                      <span className="field-label">{r.port}</span>
                      <select name="puerto" defaultValue={filters.puerto ?? ""} className="field">
                        <option value="">{r.allPorts}</option>
                        {locations.ports.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} ({p.count})
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="field-label">{r.boatLength}</span>
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
                        <span className="field-label">{r.boatBeam}</span>
                        <select name="manga" defaultValue={filters.manga ?? ""} className="field px-2">
                          <option value="">Cualquiera</option>
                          {[2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8].map((n) => (
                            <option key={n} value={n}>
                              {n.toLocaleString(d.locale)} m
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block">
                      <span className="field-label">{r.mooringType}</span>
                      <select name="tipoAmarre" defaultValue={filters.tipoAmarre ?? ""} className="field">
                        <option value="">{r.all}</option>
                        {Object.entries(L.mooringTypes).map(([k, v]) => (
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
                      <span className="field-label">{r.zone}</span>
                      <input name="zona" defaultValue={filters.zona ?? ""} placeholder={r.any} className="field" maxLength={80} />
                    </label>
                    <label className="block">
                      <span className="field-label">{r.type}</span>
                      <select name="grupo" defaultValue={filters.grupo ?? ""} className="field">
                        <option value="">{r.all}</option>
                        {HOME_SEARCH_GROUPS.map((g) => (
                          <option key={g} value={g}>
                            {d.groups[g]}
                          </option>
                        ))}
                        <option value="amarres">{d.groups.amarres}</option>
                      </select>
                    </label>
                    {filters.tipo && <input type="hidden" name="tipo" value={filters.tipo} />}
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="field-label">{r.priceMin}</span>
                    <select name="min" defaultValue={filters.min ?? ""} className="field px-2">
                      <option value="">{r.noMin}</option>
                      {PRICE_STEPS[category][operation].map((v) => (
                        <option key={v} value={v}>
                          {eur(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">{r.priceMax}</span>
                    <select name="max" defaultValue={filters.max ?? ""} className="field px-2">
                      <option value="">{r.noMax}</option>
                      {PRICE_STEPS[category][operation].map((v) => (
                        <option key={v} value={v}>
                          {eur(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {showRooms && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="field-label">{r.rooms}</span>
                        <select name="hab" defaultValue={filters.hab ?? ""} className="field px-2">
                          <option value="">{r.allF}</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {r.orMore(n)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="field-label">{r.baths}</span>
                        <select name="banos" defaultValue={filters.banos ?? ""} className="field px-2">
                          <option value="">{r.all}</option>
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {r.orMore(n)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </>
                )}
                {showSize && (
                  <label className="block">
                    <span className="field-label">{groupKind === "LAND" ? r.landSize : r.size}</span>
                    <select name="m2" defaultValue={filters.m2 ?? ""} className="field">
                      <option value="">{r.anySize}</option>
                      {(groupKind === "LAND" ? [200, 500, 1000, 2000, 5000, 10000, 50000] : [40, 60, 80, 100, 120, 150, 200, 300, 500]).map((n) => (
                        <option key={n} value={n}>
                          {r.fromM2(n.toLocaleString(d.locale))}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {groupKind === "DWELLING" && (
                  <label className="block">
                    <span className="field-label">{r.condition}</span>
                    <select name="estado" defaultValue={filters.estado ?? ""} className="field">
                      <option value="">{r.any}</option>
                      {Object.entries(L.conditions).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {groupKind === "LAND" && (
                  <>
                    <label className="block">
                      <span className="field-label">{r.landClass}</span>
                      <select name="clas" defaultValue={filters.clas ?? ""} className="field">
                        <option value="">{r.anyF}</option>
                        {Object.entries(L.landClasses).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="field-label">{r.landUse}</span>
                      <select name="uso" defaultValue={filters.uso ?? ""} className="field">
                        <option value="">{r.any}</option>
                        {Object.entries(L.landUses).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {mooring && (
                  <label className="flex items-center gap-2 text-[13.5px] text-ink-700">
                    <input type="checkbox" name="disp" value="ya" defaultChecked={filters.disp === "ya"} className="h-4 w-4 rounded border-sand-300" />
                    {r.availableNow}
                  </label>
                )}
                {featureOptions.length > 0 && (
                <fieldset>
                  <legend className="field-label">{mooring ? r.services : r.features}</legend>
                  <div className="grid grid-cols-1 gap-1.5">
                    {featureOptions.map((code) => (
                      <label key={code} className="flex items-center gap-2 text-[13.5px] text-ink-700">
                        <input type="checkbox" name="car" value={code} defaultChecked={selectedFeatures.has(code)} className="h-4 w-4 rounded border-sand-300" />
                        {featureLabels[code]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                )}
                {filters.orden && <input type="hidden" name="orden" value={filters.orden} />}
                <AutoSubmit />
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="h-10 flex-1 rounded-full bg-ink-800 text-sm font-medium text-white hover:bg-ink-700">
                    {r.search}
                  </button>
                  {anyFilter && (
                    <Link href={base} className="flex h-10 items-center rounded-full border border-sand-300 px-4 text-sm text-ink-600 hover:bg-sand-50">
                      {r.clear}
                    </Link>
                  )}
                </div>
              </form>
            </div>
          </aside>

          <section aria-label={title} className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink-800">{noun(result.total)}</h2>
              {result.total > 1 && (
                <nav aria-label={r.sortAria} className="flex gap-1 text-[13px]">
                  {(
                    [
                      ["recientes", r.sortRecent],
                      ["precio-asc", r.sortCheap],
                      ["precio-desc", r.sortExpensive],
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
                    aria-label={r.removeFilter(c.label)}
                  >
                    {c.label} <X className="h-3.5 w-3.5 text-ink-400" />
                  </Link>
                ))}
                <Link href={base} className="px-1 text-[13px] text-ink-500 underline-offset-2 hover:underline">
                  {r.removeAll}
                </Link>
              </div>
            )}

            {result.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
                {mooring ? <Anchor className="mx-auto h-9 w-9 text-ink-200" /> : <Home className="mx-auto h-9 w-9 text-ink-200" />}
                <h2 className="mt-4 text-lg font-semibold text-ink-800">
                  {anyFilter ? r.notFoundTitle(mooring) : r.noneYetTitle(mooring)}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
                  {anyFilter ? r.notFoundText : r.noneYetText(mooring, rent)}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {anyFilter && (
                    <ButtonLink href={base} variant="outline">
                      {r.seeAll}
                    </ButtonLink>
                  )}
                  <ButtonLink href={mooring ? "/publicar?tipo=amarre" : "/publicar"} variant="accent">
                    {d.nav.publish}
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((l) => (
                  <ListingCard key={l.reference} l={{ ...l, title: localizedTexts(l, siteLang).title ?? l.title }} t={d.card} labels={L} locale={d.locale} />
                ))}
              </div>
            )}

            {result.pages > 1 && (
              <nav aria-label={r.pages} className="mt-8 flex items-center justify-center gap-2 text-sm">
                {result.page > 1 && (
                  <Link href={`${base}${qs(filters, { pagina: result.page - 1 === 1 ? undefined : result.page - 1 })}`} className="rounded-full border border-sand-300 bg-white px-4 py-2 hover:bg-sand-50">
                    {r.prev}
                  </Link>
                )}
                <span className="px-3 text-ink-500">
                  {r.page(result.page, result.pages)}
                </span>
                {result.page < result.pages && (
                  <Link href={`${base}${qs(filters, { pagina: result.page + 1 })}`} className="rounded-full border border-sand-300 bg-white px-4 py-2 hover:bg-sand-50">
                    {r.next}
                  </Link>
                )}
              </nav>
            )}

            {cities.length > 0 && (
              <nav aria-label={r.byTownAria} className="mt-10 rounded-2xl border border-sand-200 bg-white p-5">
                <h2 className="text-[15px] font-semibold text-ink-800">
                  {r.byTown(mooring, rent)}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {cities.slice(0, 40).map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={cityPath(category, operation, c.name)}
                        className={`inline-block rounded-full border px-3 py-1 text-[13px] ${city?.name === c.name ? "border-ink-800 bg-ink-800 text-white" : "border-sand-300 text-ink-700 hover:border-ink-300"}`}
                      >
                        {c.name} <span className={city?.name === c.name ? "text-sand-200" : "text-ink-400"}>({c.count})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] text-ink-500">
                  {r.also}{" "}
                  {mooring ? (
                    <Link href={rent ? "/amarres/comprar" : "/amarres/alquilar"} className="underline">
                      {rent ? r.linkMooringSale : r.linkMooringRent}
                    </Link>
                  ) : (
                    <Link href={rent ? "/comprar" : "/alquilar"} className="underline">
                      {rent ? r.linkSale : r.linkRent}
                    </Link>
                  )}{" "}
                  ·{" "}
                  <Link href={mooring ? "/comprar" : "/amarres/comprar"} className="underline">
                    {mooring ? r.linkSale : r.linkMooringSale}
                  </Link>{" "}
                  ·{" "}
                  <Link href="/estudio" className="underline">
                    {r.linkValuate}
                  </Link>
                </p>
              </nav>
            )}

            <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-sand-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink-800">{r.publishBoxTitle(mooring)}</p>
                <p className="text-sm text-ink-500">{r.publishBoxText}</p>
              </div>
              <ButtonLink href={mooring ? "/publicar?tipo=amarre" : "/publicar"} variant="accent" className="shrink-0">
                {d.nav.publish}
              </ButtonLink>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-ink-400">
              {r.disclaimer}
            </p>
          </section>
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
