"use client";
// Traducciones del anuncio (catalán, inglés, alemán y francés): las prepara la IA y el administrador
// puede revisarlas y corregirlas antes de que se vean en la web en cada idioma.
import { useActionState, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import type { FormState } from "./ListingForm";

type Texts = { title?: string; description?: string; extraInfo?: string; distribution?: string; rentConditions?: string };
const LANGS = [
  ["ca", "Català"],
  ["en", "English"],
  ["de", "Deutsch"],
  ["fr", "Français"],
] as const;

export function TranslationsPanel({
  status,
  langs,
  fields,
  onTranslate,
  onSave,
}: {
  status: "fresh" | "stale" | "none";
  langs: Partial<Record<"ca" | "en" | "de" | "fr", Texts>>;
  /** Campos con texto en español (solo esos se traducen). */
  fields: Array<keyof Texts>;
  onTranslate: () => Promise<FormState>;
  onSave: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [tab, setTab] = useState<(typeof LANGS)[number][0]>("ca");
  const [tState, translate, translating] = useActionState<FormState>(async () => onTranslate(), {});
  const [sState, save, saving] = useActionState(onSave, {});
  const labels: Record<keyof Texts, string> = { title: "Título", description: "Descripción", extraInfo: "Información adicional", distribution: "Distribución", rentConditions: "Condiciones del alquiler" };

  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-800">
            <Languages className="h-4 w-4" /> Traducciones (CA · EN · DE · FR)
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {status === "fresh"
              ? "Al día: la web muestra el anuncio traducido en cada idioma."
              : status === "stale"
                ? "Desactualizadas: has cambiado el texto en español. Vuelve a traducir; mientras, en otros idiomas se muestra el original en español."
                : "Sin traducir: en otros idiomas el anuncio se muestra en español. Se traduce solo al publicar, si la IA está activada."}
          </p>
        </div>
        <form action={translate}>
          <button disabled={translating} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-terracotta-500 px-4 text-sm font-medium text-white hover:bg-terracotta-600 disabled:opacity-60">
            {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />} {status === "none" ? "Traducir con IA" : "Volver a traducir con IA"}
          </button>
        </form>
      </div>
      {tState.error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {tState.error}
        </p>
      )}
      {tState.ok && !translating && <p className="mt-3 text-sm text-pine-600">Traducido. Revisa los textos antes de dar por buena la versión de cada idioma.</p>}

      <form action={save} className="mt-4">
        <div role="tablist" aria-label="Idioma" className="inline-flex rounded-full bg-sand-100 p-1 text-sm font-medium">
          {LANGS.map(([code, name]) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={tab === code}
              onClick={() => setTab(code)}
              className={`rounded-full px-4 py-1.5 ${tab === code ? "bg-white text-ink-800 shadow-sm" : "text-ink-500"}`}
            >
              {name}
            </button>
          ))}
        </div>
        {LANGS.map(([code]) => (
          <div key={code} hidden={tab !== code} className="mt-4 space-y-3">
            {fields.map((f) => (
              <label key={f} className="block">
                <span className="field-label">{labels[f]}</span>
                {f === "title" ? (
                  <input name={`${code}.${f}`} defaultValue={langs[code]?.[f] ?? ""} maxLength={160} className="field" />
                ) : (
                  <textarea name={`${code}.${f}`} defaultValue={langs[code]?.[f] ?? ""} rows={f === "description" ? 7 : 3} maxLength={8000} className="field" />
                )}
              </label>
            ))}
          </div>
        ))}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-800 px-4 text-sm font-medium text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar traducciones revisadas
          </button>
          {sState.error && <p className="text-sm text-red-600">{sState.error}</p>}
          {sState.ok && !saving && <p className="text-sm text-pine-600">Traducciones guardadas</p>}
        </div>
      </form>
    </section>
  );
}
