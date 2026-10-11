import { Check } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PublishRequestForm } from "@/components/portal/PublishRequestForm";
import { getDictionary } from "@/lib/i18n";
import { PORTAL_PROVINCE_CODES } from "@/services/listings/catalog";
import { portalMetadata } from "@/services/listings/seo";
import { PUBLICATION_MARKETING_TEXT, PUBLICATION_OWNER_TEXT, PUBLICATION_PRIVACY_TEXT } from "@/services/listings/publicationRequests";
import { PROVINCES } from "@/services/study/geo";

export const metadata = portalMetadata({
  title: "Publica tu inmueble gratis",
  description: "Anuncia gratis tu piso, tu casa o tu amarre en Cataluña: envíanos los datos y las fotos, lo revisamos y lo publicamos sin coste.",
  path: "/publicar",
});

export default async function PublishPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const dict = getDictionary("es");
  const mooring = (await searchParams).tipo === "amarre";
  const provinces = PROVINCES.filter((p) => PORTAL_PROVINCE_CODES.includes(p.code))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map(({ code, name }) => ({ code, name }));

  return (
    <div lang="es">
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="bg-sand-50">
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page py-8 sm:py-12">
            <p className="eyebrow">Para propietarios</p>
            <h1 className="mt-3 font-serif text-[34px] font-medium leading-tight tracking-tight text-ink-800 sm:text-5xl">
              Publica tu inmueble gratis
            </h1>
            <p className="mt-3 max-w-2xl text-[15.5px] text-ink-500">
              Pisos, casas, locales, oficinas, garajes, terrenos o amarres en Cataluña. Envíanos los datos y las fotos: revisamos la solicitud, te contactamos y preparamos el anuncio. Sin coste.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-ink-500">
              {["Publicación gratuita", "Revisamos cada anuncio", "Tus datos de contacto no se publican"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-terracotta-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <div className="container-page max-w-3xl py-8 sm:py-10">
          <PublishRequestForm
            initialCategory={mooring ? "MOORING" : "HOME"}
            provinces={provinces}
            texts={{ owner: PUBLICATION_OWNER_TEXT, privacy: PUBLICATION_PRIVACY_TEXT, marketing: PUBLICATION_MARKETING_TEXT }}
          />
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
