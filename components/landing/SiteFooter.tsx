import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";
import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";

const link = "w-fit rounded hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export async function SiteFooter({ dict, lang }: { dict: Dictionary; lang: Language }) {
  void dict;
  void lang;
  const d = portalDict(await getSiteLang());
  return (
    <footer className="bg-ink-800 text-ink-100">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-200">
            {d.footer.tagline}
          </p>
        </div>
        <nav aria-label="Portal" className="flex flex-col gap-2.5 text-sm">
          <p className="font-semibold text-white">FINCALIA360</p>
          {(
            [
              [d.nav.home, "/"],
              [d.nav.sale, "/comprar"],
              [d.nav.rent, "/alquilar"],
              [d.nav.transfers, "/traspasos"],
              [d.nav.searching, "/busco-piso"],
              [d.nav.valuate, "/estudio"],
              [d.nav.publish, "/publicar"],
              [d.nav.contact, "/contacto"],
            ] as const
          ).map(([label, href]) => (
            <Link key={href} href={href} className={link}>
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label={d.footer.legalTitle} className="flex flex-col gap-2.5 text-sm">
          <p className="font-semibold text-white">{d.footer.legalTitle}</p>
          <Link href="/legal" className={link}>
            {d.footer.legalNotice}
          </Link>
          <Link href="/privacy" className={link}>
            {d.footer.privacy}
          </Link>
          <Link href="/cookies" className={link}>
            {d.footer.cookies}
          </Link>
          <Link href="/condiciones" className={link}>
            {d.footer.terms}
          </Link>
          <Link href="/admin" className={`${link} text-ink-300`}>
            {d.footer.team} ↗
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-4 text-xs text-ink-300">
          © {new Date().getFullYear()} FINCALIA360 · {d.footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}
