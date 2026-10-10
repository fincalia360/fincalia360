/* eslint-disable @next/next/no-img-element -- planos generados en el servidor (PNG) */
"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import type { CatastroValueZone } from "@/services/study/types";

const MAPS = [
  { kind: "zona", title: "Plano de situación", attribution: "© Instituto Geográfico Nacional (IGN Base, CC BY 4.0)" },
  { kind: "ortofoto", title: "Vista aérea con la parcela", attribution: "© IGN (PNOA, CC BY 4.0) · Parcelas: Dirección General del Catastro" },
  { kind: "parcela", title: "Plano catastral de la parcela", attribution: "Dirección General del Catastro" },
] as const;

function MapImage({ studyId, kind, title, attribution }: { studyId: string; kind: string; title: string; attribution: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const ref = useRef<HTMLImageElement>(null);
  // La imagen puede terminar de cargarse antes de que React escuche «onLoad» (hidratación)
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "ok" : "error");
  }, []);
  return (
    <figure className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft">
      <div className="relative aspect-[900/620] bg-sand-100">
        {state === "loading" && <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">Cargando plano…</p>}
        {state === "error" ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink-500">El servicio cartográfico no ha respondido. Vuelve a intentarlo más tarde.</p>
        ) : (
          <img
            ref={ref}
            src={`/api/estudio/${studyId}/mapa/${kind}`}
            alt={title}
            loading="lazy"
            onLoad={() => setState("ok")}
            onError={() => setState("error")}
            className={state === "ok" ? "h-full w-full object-cover" : "h-full w-full object-cover opacity-0"}
          />
        )}
      </div>
      <figcaption className="px-4 py-2.5">
        <p className="text-sm font-semibold text-ink-800">{title}</p>
        <p className="text-[11.5px] text-ink-400">{attribution}</p>
      </figcaption>
    </figure>
  );
}

export function PropertyMapsPanel({ studyId, hasCadastralRef, valueZone }: { studyId: string; hasCadastralRef: boolean; valueZone: CatastroValueZone | null | undefined }) {
  if (!hasCadastralRef) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-sand-300 bg-white p-5 text-sm text-ink-600">
        <MapPinned className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" />
        <p>
          Para ver los planos de la zona y de la parcela, y el valor de mercado oficial de tu zona, haz el estudio buscando la vivienda por su dirección en el
          Catastro (o indicando su referencia catastral).
        </p>
      </div>
    );
  }
  const r = valueZone?.residential;
  return (
    <div className="space-y-4">
      {valueZone && (r || valueZone.garage) && (
        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Valor de mercado oficial de tu zona · Catastro {valueZone.year}</p>
          <div className="mt-2 flex flex-wrap gap-x-10 gap-y-3">
            {r && (
              <div>
                <p className="font-serif text-3xl text-ink-800">{r.mvmM2.toLocaleString("es-ES")} €/m²</p>
                <p className="text-xs text-ink-500">Vivienda representativa · zona {valueZone.zone}</p>
              </div>
            )}
            {valueZone.garage && (
              <div>
                <p className="font-serif text-3xl text-ink-800">{valueZone.garage.value.toLocaleString("es-ES")} €</p>
                <p className="text-xs text-ink-500">Plaza de garaje representativa</p>
              </div>
            )}
          </div>
          {r && (
            <p className="mt-3 text-xs text-ink-500">
              Vivienda representativa: {[r.typology, r.sqm ? `${r.sqm} m²` : null, r.category ? `calidad ${r.category.toLowerCase()}` : null, r.ageYears != null ? `${r.ageYears} años` : null, r.conservation ? `conservación ${r.conservation.toLowerCase()}` : null]
                .filter(Boolean)
                .join(", ")}
              {r.dwellings ? ` · ${r.dwellings.toLocaleString("es-ES")} viviendas en la zona` : ""}.
            </p>
          )}
          <p className="mt-1 text-xs text-ink-400">
            Módulo de valor medio calculado por la Dirección General del Catastro con los precios de las compraventas escrituradas (Informe Anual del Mercado
            Inmobiliario).{" "}
            <a href={valueZone.source.url} target="_blank" rel="noreferrer" className="underline">
              Ver el mapa de valores
            </a>
            .
          </p>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {MAPS.map((m) => (
          <MapImage key={m.kind} studyId={studyId} {...m} />
        ))}
      </div>
      <p className="text-xs text-ink-400">El Catastro solo publica el contorno de la parcela y de las construcciones: el plano interior de la vivienda no es público.</p>
    </div>
  );
}
