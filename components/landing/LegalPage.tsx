import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";

export function LegalPage({
  dict,
  lang,
  basePath,
  title,
  children,
}: {
  dict: Dictionary;
  lang: Language;
  basePath: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div lang={lang}>
      <SiteHeader dict={dict} lang={lang} basePath={basePath} showNav={false} />
      <main className="container-page py-12 sm:py-16">
        <article className="mx-auto max-w-3xl">
          <div className="mb-8 rounded-xl border border-dashed border-terracotta-400 bg-terracotta-50 p-4 text-sm leading-relaxed text-terracotta-700">
            <strong>TEXTO DEMO — NO VÁLIDO LEGALMENTE.</strong> Este contenido es un marcador de posición para la demostración del MVP. Debe
            sustituirse por textos redactados y revisados por un profesional jurídico antes de captar datos reales. Nada de lo aquí
            escrito constituye asesoramiento jurídico.
          </div>
          <h1 className="font-serif text-5xl font-medium tracking-tight">{title}</h1>
          <div className="mt-8 space-y-6 leading-relaxed text-ink-600 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-ink-800 [&_li]:ml-5 [&_li]:list-disc">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter dict={dict} lang={lang} />
    </div>
  );
}
