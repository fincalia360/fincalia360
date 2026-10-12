import { portalDict } from "@/lib/i18n/site";
import { catalogLabels } from "@/lib/i18n/portal/labels";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { Check } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PublishRequestForm } from "@/components/portal/PublishRequestForm";
import { getDictionary } from "@/lib/i18n";
import { PORTAL_PROVINCE_CODES } from "@/services/listings/catalog";
import { portalMetadata } from "@/services/listings/seo";
import { PROVINCES } from "@/services/study/geo";

export async function generateMetadata() {
  const m = portalDict(await getSiteLang()).meta.publish;
  return portalMetadata({ title: m.title, description: m.description, path: "/publicar" });
}

export default async function PublishPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const dict = getDictionary("es");
  const lang = await getSiteLang();
  const d = portalDict(lang);
  const tipo = (await searchParams).tipo;
  const mooring = tipo === "amarre";
  const business = tipo === "negocio";
  const provinces = PROVINCES.filter((p) => PORTAL_PROVINCE_CODES.includes(p.code))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map(({ code, name }) => ({ code, name }));

  return (
    <div>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="bg-sand-50">
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page py-8 sm:py-12">
            <p className="eyebrow">{d.publish.eyebrow}</p>
            <h1 className="mt-3 font-serif text-[34px] font-medium leading-tight tracking-tight text-ink-800 sm:text-5xl">
              {d.publish.title}
            </h1>
            <p className="mt-3 max-w-2xl text-[15.5px] text-ink-500">
              {d.publish.intro}
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-ink-500">
              {d.publish.bullets.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-terracotta-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <div className="container-page max-w-3xl py-8 sm:py-10">
          <PublishRequestForm
            initialCategory={mooring ? "MOORING" : business ? "BUSINESS" : "HOME"}
            provinces={provinces}
            types={catalogLabels(lang).types}
            lang={lang}
          />
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
