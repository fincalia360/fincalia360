import type { Metadata } from "next";
import { BarChart3, FileText, Landmark, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { StudyWizard } from "@/components/study/StudyWizard";
import { getDictionary } from "@/lib/i18n";
import { StudyI18nProvider } from "@/components/study/StudyI18n";
import { studyMessages, studyT } from "@/lib/i18n/study/messages";
import { getSiteLang } from "@/lib/i18n/siteServer";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getSiteLang();
  const t = studyT(lang);
  return {
    title: t("¿Te interesa más vender o alquilar tu vivienda?"),
    description:
      lang === "es"
        ? "Estudio gratuito: cuánto puede valer tu vivienda, qué rentabilidad podrías obtener alquilándola y qué gastos, impuestos y riesgos debes tener en cuenta. Con datos oficiales y fuentes citadas."
        : t("Descubre cuánto puede valer tu propiedad, qué rentabilidad podrías obtener alquilándola y qué gastos y riesgos debes tener en cuenta antes de decidir."),
  };
}

const POINTS = [
  {
    icon: Landmark,
    title: "Datos oficiales y citados",
    text: "INE, Ministerio de Vivienda (SERPAVI y zonas tensionadas) y Catastro, con fecha y fuente.",
  },
  {
    icon: BarChart3,
    title: "Vender, alquilar o mantener",
    text: "Escenarios a 1, 3, 5 y 10 años con hipótesis que puedes cambiar.",
  },
  {
    icon: ShieldCheck,
    title: "Riesgos e impuestos",
    text: "Impagos, plusvalía, IRPF y gastos, sin letra pequeña.",
  },
  {
    icon: FileText,
    title: "Informe PDF gratuito",
    text: "Sin registrarte y sin aceptar publicidad.",
  },
];

export default async function StudyPage() {
  const lang = await getSiteLang();
  const t = studyT(lang);
  const dict = getDictionary("es");
  return (
    <div lang={lang}>
      <SiteHeader dict={dict} lang="es" basePath="/" />
      <main>
        <section className="border-b border-sand-200 bg-white">
          <div className="container-page grid gap-10 py-10 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="eyebrow">{t("Estudio gratuito")}</p>
              <h1 className="mt-4 font-serif text-[38px] font-medium leading-[1.05] tracking-tight text-ink-800 sm:text-6xl">
                {t("¿Te interesa más vender o alquilar tu vivienda?")}
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-500 sm:text-lg">
                {t("Descubre cuánto puede valer tu propiedad, qué rentabilidad podrías obtener alquilándola y qué gastos y riesgos debes tener en cuenta antes de decidir.")}
              </p>
              <a
                href="#calcular"
                className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-terracotta-500 px-6 text-[15px] font-medium text-white shadow-sm hover:bg-terracotta-600"
              >
                {t("Calcular mi estudio gratuito")}
              </a>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {POINTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl border border-sand-200 bg-sand-50 p-5">
                  <Icon className="h-5 w-5 text-terracotta-600" />
                  <p className="mt-3 font-medium text-ink-800">{t(title)}</p>
                  <p className="mt-1 text-sm text-ink-500">{t(text)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section id="calcular" className="container-page scroll-mt-20 py-10 sm:py-14">
          <div className="mx-auto max-w-3xl rounded-3xl border border-sand-200 bg-white p-5 shadow-soft sm:p-10">
            <StudyI18nProvider lang={lang} messages={studyMessages(lang)}>
              <StudyWizard />
            </StudyI18nProvider>
          </div>
          <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-ink-400">
            {t("Herramienta orientativa. No constituye asesoramiento financiero, fiscal ni jurídico ni sustituye una valoración profesional.")}
          </p>
        </section>
      </main>
      <SiteFooter dict={dict} lang="es" />
    </div>
  );
}
