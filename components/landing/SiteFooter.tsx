import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";

const link = "w-fit rounded hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function SiteFooter({ dict, lang }: { dict: Dictionary; lang: Language }) {
  return (
    <footer className="bg-ink-800 text-ink-100">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-200">
            Portal inmobiliario en Cataluña: inmuebles y amarres en venta y en alquiler, publicación gratuita para propietarios y valoración de viviendas en toda España.
          </p>
        </div>
        <nav aria-label="Portal" className="flex flex-col gap-2.5 text-sm">
          <p className="font-semibold text-white">FINCALIA360</p>
          {(
            [
              ["Inicio", "/"],
              ["Venta", "/comprar"],
              ["Alquiler", "/alquilar"],
              ["Valorar vivienda", "/estudio"],
              ["Publica tu inmueble gratis", "/publicar"],
              ["Contacto", "/contacto"],
            ] as const
          ).map(([label, href]) => (
            <Link key={href} href={href} className={link}>
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Información legal" className="flex flex-col gap-2.5 text-sm">
          <p className="font-semibold text-white">Información legal</p>
          <Link href={`/legal?lang=${lang}`} className={link}>
            {dict.footer.legal}
          </Link>
          <Link href={`/privacy?lang=${lang}`} className={link}>
            {dict.footer.privacy}
          </Link>
          <Link href="/cookies" className={link}>
            Política de cookies
          </Link>
          <Link href="/condiciones" className={link}>
            Condiciones de uso
          </Link>
          <Link href="/admin" className={`${link} text-ink-300`}>
            Acceso del equipo ↗
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-4 text-xs text-ink-300">
          © {new Date().getFullYear()} FINCALIA360 · Estudios orientativos: no sustituyen una tasación oficial ni el asesoramiento fiscal o jurídico.
        </p>
      </div>
    </footer>
  );
}
