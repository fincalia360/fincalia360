import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import type { Dictionary } from "@/lib/i18n";
import { LEGAL_UPDATED, legalLabel, legalValue, missingLegalData, type LegalKey } from "@/lib/legal";
import type { Language } from "@/types";

/** Dato del titular o un aviso visible si aún no se ha configurado. */
export function L({ k }: { k: LegalKey }) {
  const v = legalValue(k);
  return v ? <>{v}</> : <mark className="rounded bg-amber-100 px-1 text-amber-900">[{legalLabel(k)}: pendiente]</mark>;
}

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
  const missing = missingLegalData();
  return (
    <div lang="es">
      <SiteHeader dict={dict} lang={lang} basePath={basePath} />
      <main className="container-page py-12 sm:py-16">
        <article className="mx-auto max-w-3xl">
          {missing.length > 0 && (
            <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              <strong>Faltan los datos del titular de la web:</strong> {missing.join(", ")}. Se configuran al publicar la web (ver la guía de
              publicación). Recomendamos además que un profesional revise estos textos antes de recoger datos reales.
            </div>
          )}
          <h1 className="text-4xl font-extrabold tracking-tight text-ink-800 sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-ink-400">Última actualización: {LEGAL_UPDATED}</p>
          <div className="mt-8 space-y-5 leading-relaxed text-ink-600 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink-800 [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full [&_td]:border-b [&_td]:border-sand-200 [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td]:text-sm [&_th]:border-b [&_th]:border-sand-300 [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:text-sm">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter dict={dict} lang={lang} />
    </div>
  );
}
