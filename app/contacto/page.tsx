import { Mail, Megaphone, Calculator } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ContactForm } from "@/components/portal/ContactForm";
import { getDictionary } from "@/lib/i18n";
import { legalValue } from "@/lib/legal";
import { CONTACT_CONSENT_TEXT } from "@/services/contactMessages";
import { portalMetadata } from "@/services/listings/seo";

export const metadata = portalMetadata({
  title: "Contacto",
  description: "Contacta con FINCALIA360: dudas sobre un anuncio, publicar tu vivienda o tu amarre en Cataluña o valorar tu vivienda.",
  path: "/contacto",
});

export default function ContactPage() {
  const dict = getDictionary("es");
  const email = legalValue("contactEmail");
  return (
    <div lang="es">
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="bg-sand-50">
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page py-8 sm:py-12">
            <p className="eyebrow">Contacto</p>
            <h1 className="mt-3 font-serif text-[34px] font-medium leading-tight tracking-tight text-ink-800 sm:text-5xl">Hablemos</h1>
            <p className="mt-3 max-w-2xl text-[15.5px] text-ink-500">Escríbenos y te responderemos lo antes posible.</p>
          </div>
        </section>
        <div className="container-page grid gap-8 py-8 sm:py-10 lg:grid-cols-[1fr_320px]">
          <ContactForm consentText={CONTACT_CONSENT_TEXT} />
          <aside className="space-y-3 text-sm">
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 text-ink-700 hover:border-ink-200">
                <Mail className="h-5 w-5 text-terracotta-500" /> {email}
              </a>
            )}
            <Link href="/publicar" className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 text-ink-700 hover:border-ink-200">
              <Megaphone className="h-5 w-5 text-terracotta-500" /> Publica tu inmueble gratis
            </Link>
            <Link href="/estudio" className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 text-ink-700 hover:border-ink-200">
              <Calculator className="h-5 w-5 text-terracotta-500" /> Valora tu vivienda gratis
            </Link>
          </aside>
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
