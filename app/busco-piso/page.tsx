// «Busco comprar»: formulario para que quien busca un inmueble (compra o alquiler) nos diga qué necesita.
// La dirección /busco-piso se mantiene para no romper los enlaces ya compartidos.
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SearchRequestForm } from "@/components/searchRequests/SearchRequestForm";
import { getDictionary } from "@/lib/i18n";
import { searchTexts } from "@/lib/i18n/searchRequests";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { PORTAL_PROVINCE_CODES } from "@/services/listings/catalog";
import { portalMetadata } from "@/services/listings/seo";
import { PROVINCES } from "@/services/study/geo";

export async function generateMetadata() {
  const t = searchTexts(await getSiteLang());
  return portalMetadata({ title: t.metaFormTitle, description: t.metaFormDescription, path: "/busco-piso" });
}

export default async function SearchRequestPage() {
  const dict = getDictionary("es");
  const lang = await getSiteLang();
  const t = searchTexts(lang);
  const provinces = PROVINCES.filter((p) => PORTAL_PROVINCE_CODES.includes(p.code))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map(({ code, name }) => ({ code, name }));

  return (
    <div lang={lang}>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="bg-sand-50">
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page py-8 sm:py-12">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1 className="mt-3 max-w-4xl font-serif text-[30px] font-medium uppercase leading-tight tracking-tight text-ink-800 sm:text-[44px]">{t.title}</h1>
            <p className="mt-4 max-w-3xl text-[15.5px] leading-relaxed text-ink-500 sm:text-[17px]">{t.intro}</p>
            <p className="mt-5 inline-block rounded-xl bg-terracotta-50 px-4 py-3 text-[15px] font-bold uppercase tracking-wide text-terracotta-700 sm:text-base">{t.slogan}</p>
            <div>
              <a href="#formulario" className="mt-5 inline-flex h-12 items-center rounded-full bg-terracotta-500 px-7 text-[15px] font-semibold uppercase tracking-wide text-white hover:bg-terracotta-600">
                {t.cta}
              </a>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-ink-500">
              {t.bullets.map((b) => (
                <li key={b} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-terracotta-500" /> {b}
                </li>
              ))}
            </ul>
            <Link href="/busco-piso/solicitudes" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-800 underline-offset-4 hover:underline">
              {t.seeList} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
        <div id="formulario" className="container-page max-w-3xl scroll-mt-24 py-8 sm:py-10">
          <SearchRequestForm lang={lang} provinces={provinces} />
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
