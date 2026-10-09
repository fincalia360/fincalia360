import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ValuationWizard } from "@/components/valuation/ValuationWizard";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";
import { LOCATIONS, type Location } from "@/types";

type Props = { searchParams: Promise<{ lang?: string; location?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const dict = getDictionary(await getRequestLanguage((await searchParams).lang));
  return { title: dict.form.title };
}

export default async function ValuationPage({ searchParams }: Props) {
  const params = await searchParams;
  const lang = await getRequestLanguage(params.lang);
  const dict = getDictionary(lang);
  const initialLocation = (LOCATIONS as readonly string[]).includes(params.location ?? "") ? (params.location as Location) : undefined;

  return (
    <div lang={lang} className="min-h-screen">
      <SiteHeader dict={dict} lang={lang} basePath="/valorar" showNav={false} />
      <main className="container-page py-8 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center gap-3 text-sm text-ink-400">
            <span className="font-medium text-ink-600">{dict.form.title}</span>
            <span aria-hidden>·</span>
            <span>{dict.form.subtitle}</span>
          </div>
          <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft sm:p-10">
            {/* key: si cambia el idioma, se reinicia el asistente con los textos nuevos */}
            <ValuationWizard key={lang} dict={dict} lang={lang} initialLocation={initialLocation} />
          </div>
        </div>
      </main>
    </div>
  );
}
