import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";

export function SiteFooter({ dict, lang }: { dict: Dictionary; lang: Language }) {
  return (
    <footer className="bg-ink-800 text-ink-100">
      <div className="container-page grid gap-8 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm text-ink-200">
            Plataforma para propietarios de toda España: valor estimado de la vivienda, alquiler máximo legal y comparativa entre vender, alquilar o mantener. Compra y alquiler de inmuebles en Cataluña.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-white">Portal en Cataluña</p>
          <Link href="/comprar" className="hover:text-white">
            Comprar vivienda
          </Link>
          <Link href="/alquilar" className="hover:text-white">
            Alquilar vivienda
          </Link>
          <Link href="/amarres/comprar" className="hover:text-white">
            Comprar amarre
          </Link>
          <Link href="/amarres/alquilar" className="hover:text-white">
            Alquilar amarre
          </Link>
          <Link href="/publicar" className="hover:text-white">
            Publica tu vivienda gratis
          </Link>
        </div>
        <div className="flex flex-col gap-2 text-sm md:items-end">
          <Link href="/estudio" className="hover:text-white">
            Analizar mi vivienda
          </Link>
          <Link href={`/privacy?lang=${lang}`} className="hover:text-white">
            {dict.footer.privacy}
          </Link>
          <Link href={`/legal?lang=${lang}`} className="hover:text-white">
            {dict.footer.legal}
          </Link>
          <Link href="/cookies" className="hover:text-white">
            Política de cookies
          </Link>
          <Link href="/condiciones" className="hover:text-white">
            Condiciones de uso
          </Link>
          <Link href="/admin" className="text-ink-300 hover:text-white">
            Acceso del equipo ↗
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-4 text-xs text-ink-300">
          © {new Date().getFullYear()} FINCALIA360 · Estudios orientativos: no sustituyen una tasación oficial ni el asesoramiento fiscal o jurídico.
        </p>
      </div>
    </footer>
  );
}
