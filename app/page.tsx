import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PortalHome, ValuationIntro } from "@/components/landing/PortalShortcuts";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary } from "@/lib/i18n";
import { getRequestLanguage } from "@/lib/i18n/server";

type Props = { searchParams: Promise<{ lang?: string }> };

export const metadata: Metadata = {
  title: { absolute: "FINCALIA360 · ¿Vender o alquilar tu vivienda?" },
  description:
    "Descubre cuánto vale tu inmueble, qué alquiler máximo legal le corresponde y qué opción puede convenirte más. Estudio gratuito para propietarios de toda España.",
};

const STUDY = "/estudio";

const SERVICES = [
  {
    title: "Valoración estimada de la vivienda",
    text: "Un rango de precio con su método y su nivel de confianza. Si no hay datos suficientes, te lo decimos en lugar de inventar una cifra.",
    source: "Fuentes: Catastro, INE y los datos que tú aportes.",
  },
  {
    title: "Alquiler máximo legal aplicable",
    text: "Comprobamos si tu vivienda está en una zona de mercado tensionado y qué límite podría aplicarse a un contrato nuevo, indicando qué está verificado y qué falta.",
    source: "Fuentes: Ministerio de Vivienda, SERPAVI y BOE.",
  },
  {
    title: "Vender, alquilar o mantener",
    text: "Comparamos ingresos, gastos, impuestos y riesgos a 1, 3, 5 y 10 años con las mismas hipótesis, que puedes modificar.",
    source: "Cálculos explicados paso a paso en el informe.",
  },
];

const STEPS = [
  ["Identifica tu vivienda", "Con el código postal, el municipio y, si la tienes, la referencia catastral."],
  ["Cuéntanos tu situación", "Uso actual, hipoteca y objetivos. Solo lo necesario."],
  ["Revisa los resultados", "Ajusta las hipótesis y observa cómo cambia cada escenario."],
  ["Descarga tu informe", "En PDF y, si quieres, pide una valoración profesional."],
];

const NEEDED = [
  ["Código postal y municipio", "La provincia se rellena sola a partir del código postal."],
  ["Referencia catastral (opcional)", "Aparece en el recibo del IBI. Completa superficie y año desde el Catastro."],
  ["Precio y año de compra", "Opcional: mejora la valoración y el cálculo de impuestos."],
  ["Contrato de alquiler anterior", "Si lo hubo en los últimos 5 años: determina el límite legal en zona tensionada."],
  ["Hipoteca pendiente", "Opcional: para calcular el dinero neto real."],
];

const LEGEND = [
  ["Verificado", "bg-terracotta-50 text-terracotta-700", "Dato oficial o aportado por ti"],
  ["Estimación", "bg-ink-50 text-ink-600", "Calculado con un método explicado"],
  ["Hipótesis", "bg-amber-50 text-amber-800", "Supuesto que puedes modificar"],
  ["Pendiente", "bg-red-50 text-red-700", "Falta un dato para confirmarlo"],
];

const TRUST = [
  ["Fuentes oficiales", "Catastro, INE, Ministerio de Vivienda y BOE, citados con su fecha de consulta."],
  ["Sin cifras inventadas", "Si no podemos calcular algo, lo indicamos y explicamos qué dato falta."],
  ["Tus datos, protegidos", "Tu estudio solo es visible desde tu navegador. No contactamos sin tu consentimiento."],
  ["Orientativo, no vinculante", "No sustituye una tasación oficial ni el asesoramiento fiscal o jurídico."],
];

const FAQ = [
  ["¿Funciona en cualquier lugar de España?", "Sí. Usamos la lista oficial de municipios del INE y fuentes estatales. En Navarra y el País Vasco el Catastro y parte de la fiscalidad son forales: te indicaremos qué datos no podemos calcular."],
  ["¿Es una tasación oficial?", "No. Es una estimación orientativa con su método y su intervalo. Para una hipoteca o una herencia necesitarás una tasación de una sociedad homologada."],
  ["¿Cómo se calcula el alquiler máximo legal?", "Depende de si la vivienda está en zona tensionada, del contrato anterior y del tipo de propietario. Si falta algún dato, el informe lo marca como pendiente."],
  ["¿Tiene algún coste?", "El estudio y el informe son gratuitos. Solo si lo solicitas, un especialista puede contactarte para una valoración presencial."],
  ["¿Qué hacéis con mis datos?", "Los usamos únicamente para elaborar tu estudio. No los compartimos ni te enviamos publicidad sin tu consentimiento expreso."],
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-terracotta-600">{children}</p>;
}

function ExampleReport() {
  const bars = [
    ["Vender hoy", "365.200 €", "78%", "bg-ink-700"],
    ["Alquilar y vender", "402.900 €", "86%", "bg-terracotta-500"],
    ["Mantener", "438.100 €", "94%", "bg-ink-300"],
  ];
  return (
    <div aria-label="Ejemplo de informe con datos ficticios" className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-[0_24px_48px_-28px_rgba(20,43,69,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-ink-800 px-5 py-4 text-white">
        <p className="text-sm font-semibold">Resumen del estudio</p>
        <span className="rounded-md bg-white/15 px-2 py-1 text-[11px] font-bold tracking-wide">EJEMPLO · DATOS FICTICIOS</span>
      </div>
      <div className="grid gap-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Valor estimado", "Estimación", "bg-ink-50 text-ink-600", "300.000 €", "Intervalo 276.000 – 324.000 €"],
            ["Neto si vendes hoy", null, "", "271.750 €", "Tras gastos e impuestos"],
            ["Alquiler máx. legal", "Pendiente", "bg-red-50 text-red-700", "850 €/mes", "Falta confirmar el contrato anterior"],
            ["Flujo de caja año 1", "Hipótesis", "bg-amber-50 text-amber-800", "7.880 €", "Renta − gastos − impuestos"],
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
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400">Patrimonio a 10 años</p>
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

  return (
    <div lang="es">
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
              <Eyebrow>Estudio gratuito para propietarios de toda España</Eyebrow>
              <h1 className="mt-4 text-[40px] font-extrabold leading-[1.05] tracking-tight text-ink-800 sm:text-6xl">¿Vender o alquilar tu vivienda?</h1>
              <p className="mt-5 max-w-xl text-lg text-ink-500 sm:text-xl">
                Descubre cuánto vale tu inmueble, qué alquiler máximo legal le corresponde y qué opción puede convenirte más.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={STUDY} variant="accent" size="lg" className="w-full sm:w-auto">
                  Analizar mi vivienda <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href="#ejemplo" variant="outline" size="lg" className="w-full sm:w-auto">
                  Ver un informe de ejemplo
                </ButtonLink>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-400">
                {["Gratis y sin compromiso", "Datos oficiales citados", "Informe en PDF"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-terracotta-500" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div id="ejemplo" className="scroll-mt-24">
              <ExampleReport />
            </div>
          </div>
        </section>

        {/* Servicios */}
        <section id="servicios" className="scroll-mt-20 border-y border-sand-200 bg-white py-16 sm:py-20">
          <div className="container-page">
            <Eyebrow>Qué obtienes</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">Tres respuestas para decidir con datos</h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {SERVICES.map((s, i) => (
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
            <Eyebrow>Cómo funciona</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">Tu estudio en unos minutos</h2>
            <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="relative">
                  <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full bg-ink-800 text-sm font-bold text-white">{i + 1}</span>
                  {i < STEPS.length - 1 && <span aria-hidden className="absolute left-9 right-0 top-[17px] hidden h-0.5 bg-sand-200 lg:block" />}
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
              <Eyebrow>Qué información necesitas</Eyebrow>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">Ten a mano estos datos</h2>
              <ul className="mt-7 grid gap-4">
                {NEEDED.map(([title, note]) => (
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
              <h3 className="text-lg font-bold">Transparencia en cada cifra</h3>
              <p className="mt-2.5 text-[15px] text-ink-200">
                Cada resultado indica su origen y su fecha. Nunca presentamos una estimación como una tasación ni una hipótesis como un dato verificado.
              </p>
              <ul className="mt-6 grid gap-2.5 text-sm text-ink-100">
                {LEGEND.map(([chip, cls, text]) => (
                  <li key={chip} className="flex items-center gap-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{chip}</span> {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Compromiso */}
        <section className="py-16 sm:py-20">
          <div className="container-page">
            <Eyebrow>Nuestro compromiso</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">Información clara antes de decidir</h2>
            <div className="mt-11 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map(([title, text]) => (
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
            <Eyebrow>Preguntas frecuentes</Eyebrow>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-800 sm:text-4xl">Lo que suelen preguntarnos</h2>
            <div className="mt-8 max-w-3xl">
              {FAQ.map(([q, a], i) => (
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
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Toma la decisión con números claros</h2>
            <p className="mx-auto mt-3.5 max-w-xl text-[17px] text-ink-200">Obtén tu estudio personalizado gratuito: valor, alquiler legal y comparativa de escenarios.</p>
            <ButtonLink href={STUDY} variant="accent" size="lg" className="mt-7">
              Analizar mi vivienda <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </section>
      </main>

      <SiteFooter dict={dict} lang={lang} />
    </div>
  );
}
