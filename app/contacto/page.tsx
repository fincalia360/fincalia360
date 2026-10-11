import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { Mail, Megaphone, Calculator } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ContactForm } from "@/components/portal/ContactForm";
import { getDictionary } from "@/lib/i18n";
import { legalValue } from "@/lib/legal";
import { portalMetadata } from "@/services/listings/seo";

export async function generateMetadata() {
  const m = portalDict(await getSiteLang()).meta.contact;
  return portalMetadata({ title: m.title, description: m.description, path: "/contacto" });
}

export default async function ContactPage() {
  const dict = getDictionary("es");
  const lang = await getSiteLang();
  const d = portalDict(lang);
  const email = legalValue("contactEmail");
  return (
    <div>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main className="bg-sand-50">
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page py-8 sm:py-12">
            <p className="eyebrow">{d.contact.eyebrow}</p>
            <h1 className="mt-3 font-serif text-[34px] font-medium leading-tight tracking-tight text-ink-800 sm:text-5xl">{d.contact.title}</h1>
            <p className="mt-3 max-w-2xl text-[15.5px] text-ink-500">{d.contact.intro}</p>
          </div>
        </section>
        <div className="container-page grid gap-8 py-8 sm:py-10 lg:grid-cols-[1fr_320px]">
          <ContactForm t={d.contact} lang={lang} />
          <aside className="space-y-3 text-sm">
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 text-ink-700 hover:border-ink-200">
                <Mail className="h-5 w-5 text-terracotta-500" /> {email}
              </a>
            )}
            <Link href="/publicar" className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 text-ink-700 hover:border-ink-200">
              <Megaphone className="h-5 w-5 text-terracotta-500" /> {d.contact.publish}
            </Link>
            <Link href="/estudio" className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white p-4 text-ink-700 hover:border-ink-200">
              <Calculator className="h-5 w-5 text-terracotta-500" /> {d.contact.valuate}
            </Link>
          </aside>
        </div>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
