import type { Metadata } from "next";
import { ArrowRight, Clock, Handshake, Languages } from "lucide-react";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { CoastIllustration } from "@/components/landing/CoastIllustration";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";
import { LANGUAGE_NAMES } from "@/lib/labels";
import { LANGUAGES, LOCATIONS } from "@/types";

type Props = { searchParams: Promise<{ lang?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const lang = await getRequestLanguage((await searchParams).lang);
  const dict = getDictionary(lang);
  return { title: { absolute: dict.meta.title }, description: dict.meta.description };
}

const PILLAR_ICONS = [Clock, Languages, Handshake];
const ZONE_NOTES: Record<string, string> = {
  ROSES: "Badia de Roses",
  EMPURIABRAVA: "Marina · canals",
  CADAQUES: "Cap de Creus",
  LLANCA: "Port de Llançà",
  CASTELLO: "Vila medieval",
  FIGUERES: "Alt Empordà",
};

export default async function LandingPage({ searchParams }: Props) {
  const lang = await getRequestLanguage((await searchParams).lang);
  const dict = getDictionary(lang);
  const valuateHref = `/valorar?lang=${lang}`;

  return (
    <div lang={lang}>
      <TrackOnMount type="landing_view" payload={{ lang }} />
      <SiteHeader dict={dict} lang={lang} />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="container-page grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
            <div>
              <p className="eyebrow">{dict.hero.eyebrow}</p>
              <h1 className="mt-4 font-serif text-[40px] font-medium leading-[1.05] tracking-tight text-ink-800 sm:text-6xl lg:text-[64px]">
                {dict.hero.title}
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-500 sm:text-lg">{dict.hero.subtitle}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href={valuateHref} variant="accent" size="lg" className="w-full sm:w-auto">
                  {dict.hero.cta}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <span className="text-center text-sm text-ink-400 sm:text-left">{dict.hero.note}</span>
              </div>
            </div>

            <div className="relative">
              <CoastIllustration className="w-full drop-shadow-sm" />
              {/* Tarjeta de inicio rápido */}
              <form
                action="/valorar"
                method="get"
                className="relative -mt-16 mx-3 rounded-2xl border border-sand-200 bg-white p-5 shadow-soft sm:mx-8 lg:absolute lg:-bottom-8 lg:-left-10 lg:mx-0 lg:mt-0 lg:w-80"
              >
                <input type="hidden" name="lang" value={lang} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">{dict.hero.cardTitle}</p>
                <label htmlFor="hero-location" className="mt-2 block font-serif text-xl text-ink-800">
                  {dict.hero.cardLabel}
                </label>
                <div className="mt-3 flex gap-2">
                  <select id="hero-location" name="location" className="field min-w-0 flex-1" defaultValue="ROSES">
                    {LOCATIONS.map((l) => (
                      <option key={l} value={l}>
                        {dict.options.location[l]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={buttonClasses({ variant: "primary", size: "md", className: "rounded-lg px-3" })} aria-label={dict.hero.cardButton}>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* PILARES */}
        <section className="border-y border-sand-200 bg-white">
          <div className="container-page grid gap-8 py-12 sm:py-14 md:grid-cols-3">
            {dict.pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i];
              return (
                <div key={p.title} className="flex gap-4">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-100 text-terracotta-600">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <h2 className="font-medium text-ink-800">{p.title}</h2>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-ink-500">{p.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" className="scroll-mt-20">
          <div className="container-page py-16 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">{dict.how.title}</h2>
              <p className="mt-4 text-lg text-ink-500">{dict.how.subtitle}</p>
            </div>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-sand-200 bg-sand-200 md:grid-cols-3">
              {dict.how.steps.map((step, i) => (
                <li key={step.title} className="bg-sand-50 p-7 sm:p-8">
                  <span className="font-serif text-5xl italic text-terracotta-500/80">0{i + 1}</span>
                  <h3 className="mt-5 text-lg font-medium text-ink-800">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-500">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ZONAS */}
        <section id="zonas" className="scroll-mt-20 bg-ink-800 text-sand-100">
          <div className="container-page grid gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="font-serif text-4xl font-medium tracking-tight text-white sm:text-5xl">{dict.zones.title}</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-sand-300">{dict.zones.text}</p>
            </div>
            <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3">
              {LOCATIONS.filter((l) => l !== "OTHER").map((l) => (
                <li key={l} className="bg-ink-800 p-5">
                  <p className="font-serif text-2xl text-white">{dict.options.location[l]}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-sand-300/70">{ZONE_NOTES[l]}</p>
                </li>
              ))}
              <li className="col-span-2 bg-ink-800 p-5 text-sm text-sand-300 sm:col-span-3">{dict.zones.more}</li>
            </ul>
          </div>
        </section>

        {/* EXTRANJERO */}
        <section id="extranjero" className="scroll-mt-20">
          <div className="container-page py-16 sm:py-24">
            <div className="grid gap-10 rounded-3xl border border-sand-200 bg-white p-7 shadow-soft sm:p-12 lg:grid-cols-[1.3fr_1fr] lg:items-center">
              <div>
                <h2 className="font-serif text-4xl font-medium tracking-tight sm:text-5xl">{dict.abroad.title}</h2>
                <p className="mt-5 text-lg leading-relaxed text-ink-500">{dict.abroad.text}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{dict.abroad.languagesLabel}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <li key={l} className="rounded-full border border-sand-300 bg-sand-50 px-3.5 py-1.5 text-sm text-ink-700">
                      {LANGUAGE_NAMES[l]}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ESTUDIO VENDER O ALQUILAR */}
        <section className="pb-16">
          <div className="container-page">
            <div className="grid gap-6 rounded-3xl border border-ink-100 bg-ink-50 p-7 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div>
                <p className="eyebrow">{dict.nav.study}</p>
                <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight sm:text-4xl">{dict.studyTeaser.title}</h2>
                <p className="mt-3 text-ink-500">{dict.studyTeaser.text}</p>
                {dict.studyTeaser.note && <p className="mt-2 text-xs text-ink-400">{dict.studyTeaser.note}</p>}
              </div>
              <div className="lg:text-right">
                <ButtonLink href="/estudio" size="lg" className="w-full sm:w-auto">
                  {dict.studyTeaser.cta}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="pb-20">
          <div className="container-page">
            <div className="relative overflow-hidden rounded-3xl bg-terracotta-500 px-7 py-12 text-white sm:px-14 sm:py-16">
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/20" />
              <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full border border-white/20" />
              <h2 className="max-w-xl font-serif text-4xl font-medium leading-tight sm:text-5xl">{dict.final.title}</h2>
              <p className="mt-4 max-w-lg text-lg text-terracotta-50">{dict.final.text}</p>
              <ButtonLink href={valuateHref} variant="light" size="lg" className="mt-8 w-full sm:w-auto">
                {dict.final.cta}
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter dict={dict} lang={lang} />
    </div>
  );
}
