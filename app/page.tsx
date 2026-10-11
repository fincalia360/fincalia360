import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PortalHome, ValuationIntro } from "@/components/landing/PortalShortcuts";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";
import { portalDict } from "@/lib/i18n/site";
import { getSiteLang } from "@/lib/i18n/siteServer";
import { valuationHomeTexts, type ValuationHomeTexts } from "@/lib/i18n/valuation/home";

type Props = { searchParams: Promise<{ lang?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const h = valuationHomeTexts(await getSiteLang());
  return { title: { absolute: h.metaTitle }, description: h.metaDescription };
}

const STUDY = "/estudio";

/** Colores de la leyenda, en el mismo orden que los textos: verificado, estimación, hipótesis, pendiente. */
const LEGEND_CLS = ["bg-terracotta-50 text-terracotta-700", "bg-ink-50 text-ink-600", "bg-amber-50 text-amber-800", "bg-red-50 text-red-700"];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-terracotta-600">{children}</p>;
}

function ExampleReport({ x, chips, locale }: { x: ValuationHomeTexts["example"]; chips: string[]; locale: string }) {
  const num = (n: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      useGrouping: "always",
    }).format(n);
  const eur = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
      useGrouping: "always",
    }).format(n);
  const bars = [
    [x.sellToday, eur(365200), "78%", "bg-ink-700"],
    [x.rentThenSell, eur(402900), "86%", "bg-terracotta-500"],
    [x.keep, eur(438100), "94%", "bg-ink-300"],
  ];
  return (
    <div aria-label={x.aria} className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-[0_24px_48px_-28px_rgba(20,43,69,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-ink-800 px-5 py-4 text-white">
        <p className="text-sm font-semibold">{x.title}</p>
        <span className="rounded-md bg-white/15 px-2 py-1 text-[11px] font-bold tracking-wide">{x.badge}</span>
      </div>
      <div className="grid gap-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          {[
            [x.estimated, chips[1], "bg-ink-50 text-ink-600", eur(300000), `${x.interval} ${num(276000)} – ${eur(324000)}`],
            [x.netSell, null, "", eur(271750), x.netSellNote],
            [x.maxRent, chips[3], "bg-red-50 text-red-700", `${eur(850)}${x.perMonth}`, x.maxRentNote],
            [x.cashflow, chips[2], "bg-amber-50 text-amber-800", eur(7880), x.cashflowNote],
          ].map(([label, chip, chipCls, value, note]) => (
            <div key={label} className="rounded-xl bg-sand-50 p-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400">
                {label} {chip && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] normal-case tracking-normal ${chipCls}`}>{chip}</span>}
              </p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-ink-800">{value}</p>
              <p className="text-xs text-ink-400">{note}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-2 text-[13px]">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400">{x.wealth}</p>
          {bars.map(([label, value, width, color]) => (
            <div key={label} className="grid grid-cols-[112px_1fr_76px] items-center gap-2.5">
              <span className="text-ink-600">{label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-sand-100">
                <span className={`block h-full rounded-full ${color}`} style={{ width }} />
              </span>
              <b className="text-right tabular-nums text-ink-800">{value}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage({ searchParams }: Props) {
  const lang = await getRequestLanguage((await searchParams).lang);
  const dict = getDictionary(lang);
  const siteLang = await getSiteLang();
  const h = valuationHomeTexts(siteLang);
  const locale = portalDict(siteLang).locale;

  return (
    <div lang={siteLang}>
      <TrackOnMount type="landing_view" payload={{ lang }} />
      <SiteHeader dict={dict} lang={lang} />

      <main>
        {/* Portal inmobiliario: buscador, venta y alquiler, categorías y publicación gratuita */}
        <PortalHome />

        {/* Valoración de vivienda: servicio independiente (contenido sin cambios) */}
        <ValuationIntro />

        {/* Bloque principal */}
        <section className="py-14 sm:py-20">
          <div className="container-page grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div>
              <Eyebrow>{h.heroEyebrow}</Eyebrow>
              <h1 className="mt-4 text-[40px] font-extrabold leading-[1.05] tracking-tight text-ink-800 sm:text-6xl">{h.heroTitle}</h1>
              <p className="mt-5 max-w-xl text-lg text-ink-500 sm:text-xl">{h.heroText}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={STUDY} variant="accent" size="lg" className="w-full sm:w-auto">
                  {h.analyze} <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href="#ejemplo" variant="outline" size="lg" className="w-full sm:w-auto">
                  {h.seeExample}
                </ButtonLink>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-400">
                {h.heroBullets.map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-terracotta-500" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div id="ejemplo" className="scroll-mt-24">
              <ExampleReport x={h.example} chips={h.legend.map(([c]) => c)} locale={locale} />
            </div>
          </div>
        </section>

        {/* Servicios */}
        <section id="servicios" className="scroll-mt-20 border-y border-sand-200 bg-white py-16 sm:py-20">
          <div className="container-page">
            <Eyebrow>{h.servicesEyebrow}</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">{h.servicesTitle}</h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {h.services.map((s, i) => (
                <div key={s.title}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-terracotta-50 font-extrabold text-terracotta-700">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-bold text-ink-800">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{s.text}</p>
                  <p className="mt-3 border-t border-sand-200 pt-3 text-[13px] text-ink-400">{s.source}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="scroll-mt-20 py-16 sm:py-20">
          <div className="container-page">
            <Eyebrow>{h.stepsEyebrow}</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">{h.stepsTitle}</h2>
            <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {h.steps.map(([title, text], i) => (
                <li key={title} className="relative">
                  <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full bg-ink-800 text-sm font-bold text-white">{i + 1}</span>
                  {i < h.steps.length - 1 && <span aria-hidden className="absolute left-9 right-0 top-[17px] hidden h-0.5 bg-sand-200 lg:block" />}
                  <h3 className="mt-4 font-bold text-ink-800">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Información necesaria y transparencia */}
        <section id="transparencia" className="scroll-mt-20 border-y border-sand-200 bg-white py-16 sm:py-20">
          <div className="container-page grid items-start gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow>{h.neededEyebrow}</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">{h.neededTitle}</h2>
              <ul className="mt-7 grid gap-4">
                {h.needed.map(([title, note]) => (
                  <li key={title} className="flex gap-3">
                    <span className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-terracotta-50">
                      <Check className="h-3.5 w-3.5 text-terracotta-700" strokeWidth={3} />
                    </span>
                    <span className="text-[15px] text-ink-800">
                      {title}
                      <span className="block text-[13.5px] text-ink-400">{note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-ink-800 p-6 text-white sm:p-8">
              <h3 className="text-lg font-bold">{h.transparencyTitle}</h3>
              <p className="mt-2.5 text-[15px] text-ink-200">{h.transparencyText}</p>
              <ul className="mt-6 grid gap-2.5 text-sm text-ink-100">
                {h.legend.map(([chip, text], i) => (
                  <li key={chip} className="flex items-center gap-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${LEGEND_CLS[i]}`}>{chip}</span> {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Compromiso */}
        <section className="py-16 sm:py-20">
          <div className="container-page">
            <Eyebrow>{h.trustEyebrow}</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">{h.trustTitle}</h2>
            <div className="mt-11 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {h.trust.map(([title, text]) => (
                <div key={title}>
                  <span className="block h-[3px] w-8 rounded bg-terracotta-500" />
                  <h3 className="mt-4 font-bold text-ink-800">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preguntas frecuentes */}
        <section id="preguntas" className="scroll-mt-20 border-y border-sand-200 bg-white py-16 sm:py-20">
          <div className="container-page">
            <Eyebrow>{h.faqEyebrow}</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">{h.faqTitle}</h2>
            <div className="mt-8 max-w-3xl">
              {h.faq.map(([q, a], i) => (
                <details key={q} open={i === 0} className="group border-b border-sand-200 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold text-ink-800 [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="text-2xl leading-none text-terracotta-500 group-open:hidden">+</span>
                    <span className="hidden text-2xl leading-none text-terracotta-500 group-open:inline">−</span>
                  </summary>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-ink-500">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Llamada final */}
        <section className="bg-ink-800 py-16 text-center text-white sm:py-20">
          <div className="container-page">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{h.finalTitle}</h2>
            <p className="mx-auto mt-3.5 max-w-xl text-[17px] text-ink-200">{h.finalText}</p>
            <ButtonLink href={STUDY} variant="accent" size="lg" className="mt-7">
              {h.analyze} <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </section>
      </main>

      <SiteFooter dict={dict} lang={lang} />
    </div>
  );
}
