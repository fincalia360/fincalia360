// Accesos directos de la portada a las secciones del portal (viviendas, amarres, valoración y publicación).
import Link from "next/link";
import { Anchor, ArrowRight, Calculator, Home, KeyRound, Megaphone, Sailboat } from "lucide-react";

const OPTIONS = [
  { href: "/comprar", title: "Comprar vivienda", text: "Pisos y casas en venta en Cataluña", icon: Home },
  { href: "/alquilar", title: "Alquilar vivienda", text: "Viviendas en alquiler revisadas", icon: KeyRound },
  { href: "/amarres/comprar", title: "Comprar amarre", text: "Amarres en venta en puertos deportivos", icon: Anchor },
  { href: "/amarres/alquilar", title: "Alquilar amarre", text: "Por días, meses, temporada o año", icon: Sailboat },
  { href: "/estudio", title: "Valorar una vivienda", text: "Estudio gratuito en toda España", icon: Calculator },
  { href: "/publicar", title: "Publica tu vivienda gratis", text: "Envíanos los datos y las fotos", icon: Megaphone },
] as const;

export function PortalShortcuts() {
  return (
    <section aria-labelledby="portal-titulo" className="border-t border-sand-200 bg-sand-50 py-12 sm:py-14">
      <div className="container-page">
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
