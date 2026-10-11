// Accesos directos de la portada a las secciones del portal (viviendas, amarres, valoración y publicación).
import Link from "next/link";
import { Anchor, ArrowRight, Calculator, Home, KeyRound, Megaphone, Sailboat, Search } from "lucide-react";
import { PROPERTY_GROUPS } from "@/services/listings/catalog";

const OPTIONS = [
  { href: "/comprar", title: "Comprar", text: "Pisos, casas, locales, garajes y terrenos en venta", icon: Home },
  { href: "/alquilar", title: "Alquilar", text: "Viviendas, locales y oficinas en alquiler", icon: KeyRound },
  { href: "/amarres/comprar", title: "Comprar amarre", text: "Amarres en venta en puertos deportivos", icon: Anchor },
  { href: "/amarres/alquilar", title: "Alquilar amarre", text: "Por días, meses, temporada o año", icon: Sailboat },
  { href: "/estudio", title: "Valorar una vivienda", text: "Estudio gratuito en toda España", icon: Calculator },
  { href: "/publicar", title: "Publica tu vivienda gratis", text: "Envíanos los datos y las fotos", icon: Megaphone },
] as const;

export function PortalShortcuts() {
  return (
    <section aria-labelledby="portal-titulo" className="border-t border-sand-200 bg-sand-50 py-12 sm:py-14">
      <div className="container-page">
        {/* Buscador del portal (venta y alquiler en Cataluña); funciona sin JavaScript */}
        <form action="/buscar" method="get" role="search" aria-label="Buscar inmuebles" className="mb-10 rounded-3xl border border-sand-200 bg-white p-4 shadow-soft sm:p-5">
          <p className="mb-3 text-lg font-extrabold tracking-tight text-ink-800 sm:text-xl">Busca inmuebles y amarres en Cataluña</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_1fr_1fr_auto]">
            <label className="block">
              <span className="sr-only">Operación</span>
              <select name="op" defaultValue="SALE" className="field">
                <option value="SALE">Comprar</option>
                <option value="RENT">Alquilar</option>
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Tipo de inmueble</span>
              <select name="grupo" defaultValue="" className="field">
                <option value="">Todos los tipos</option>
                {Object.entries(PROPERTY_GROUPS).map(([k, g]) => (
                  <option key={k} value={k}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Población</span>
              <input name="municipio" maxLength={80} placeholder="Población (opcional)" className="field" />
            </label>
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink-800 px-6 font-semibold text-white hover:bg-ink-700">
              <Search className="h-4 w-4" /> Buscar
            </button>
          </div>
        </form>

        {/* Llamada destacada: publicación gratuita para propietarios */}
        <div className="mb-10 flex flex-col gap-4 rounded-3xl bg-ink-800 p-6 text-white shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-terracotta-500 sm:grid">
              <Megaphone className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xl font-extrabold tracking-tight sm:text-2xl">Publica tu vivienda gratis</p>
              <p className="mt-1 text-[15px] text-ink-100">¿Tienes un piso, una casa o un amarre en Cataluña? Envíanos los datos y las fotos: lo revisamos y lo publicamos sin coste.</p>
            </div>
          </div>
          <Link
            href="/publicar"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-terracotta-500 px-6 font-semibold text-white transition hover:bg-terracotta-600"
          >
            Publicar gratis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <h2 id="portal-titulo" className="text-2xl font-extrabold tracking-tight text-ink-800 sm:text-3xl">
          ¿Qué quieres hacer?
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OPTIONS.map(({ href, title, text, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-lg"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-terracotta-50 text-terracotta-700">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink-800">{title}</span>
                <span className="block text-sm text-ink-500">{text}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-700" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
