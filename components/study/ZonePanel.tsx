import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Series, StudySnapshot } from "@/services/study/types";
import { LineChart } from "./charts";

const TENSIONED_TONE: Record<StudySnapshot["tensioned"]["status"], string> = {
  DECLARED: "border-amber-200 bg-amber-50 text-amber-800",
  PARTIAL: "border-amber-200 bg-amber-50 text-amber-800",
  EXPIRED: "border-sand-300 bg-sand-50 text-ink-700",
  NOT_FOUND: "border-pine-100 bg-pine-50 text-pine-600",
  UNKNOWN: "border-sand-300 bg-sand-50 text-ink-700",
};

function SeriesCard({ series, title, note }: { series: Series | null; title: string; note?: string }) {
  if (!series) return null;
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      <p className="mb-3 text-xs text-ink-400">
        {series.source.name}
        {series.source.period ? ` · ${series.source.period}` : ""}
      </p>
      <LineChart series={series} />
      {note && <p className="mt-2 text-[11.5px] text-ink-400">{note}</p>}
    </div>
  );
}

export function TensionedBanner({ t }: { t: StudySnapshot["tensioned"] }) {
  return (
    <div className={cn("rounded-2xl border p-4 text-sm", TENSIONED_TONE[t.status])}>
      <p className="font-semibold">Zona de mercado residencial tensionado: {t.summary}</p>
      {t.detail && <p className="mt-1">{t.detail}</p>}
      {t.resolution && (
        <p className="mt-1 text-xs opacity-80">
          {t.resolution} {t.bulletin}
        </p>
      )}
      <a href={t.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline">
        Fuente oficial: Ministerio de Vivienda y Agenda Urbana
        {t.source.retrievedAt ? ` (consultada el ${new Date(t.source.retrievedAt).toLocaleDateString("es-ES")})` : ""}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

export function ZonePanel({ zone, municipality }: { zone: StudySnapshot["zone"]; municipality: string }) {
  const pop = zone.population;
  const last = pop?.points[pop.points.length - 1];
  const first = pop?.points[0];
  return (
    <div className="space-y-4">
      {pop && last && first && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
            <p className="text-xs uppercase tracking-wider text-ink-400">Población ({last.period})</p>
            <p className="mt-1 font-serif text-3xl tabular-nums">{last.value.toLocaleString("es-ES")}</p>
            <p className="text-xs text-ink-400">
              {(((last.value - first.value) / first.value) * 100).toFixed(1)} % desde {first.period} · INE
            </p>
          </div>
          {zone.populationBySex && (
            <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wider text-ink-400">Hombres / mujeres ({zone.populationBySex.year})</p>
              <p className="mt-1 font-serif text-3xl tabular-nums">
                {zone.populationBySex.men.toLocaleString("es-ES")} / {zone.populationBySex.women.toLocaleString("es-ES")}
              </p>
              <p className="text-xs text-ink-400">INE · Padrón municipal</p>
            </div>
          )}
          {zone.touristDwellingsPct && (
            <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wider text-ink-400">Viviendas turísticas</p>
              <p className="mt-1 font-serif text-3xl tabular-nums">
                {zone.touristDwellingsPct.points[zone.touristDwellingsPct.points.length - 1].value.toLocaleString("es-ES")} %
              </p>
              <p className="text-xs text-ink-400">
                del total de viviendas ({zone.touristDwellingsPct.points[zone.touristDwellingsPct.points.length - 1].period}) · INE (experimental)
              </p>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SeriesCard series={pop} title={`Evolución de la población de ${municipality}`} />
        <SeriesCard series={zone.rentM2History} title="Alquiler declarado mediano (€/m²/mes)" note="Rentas de contratos de vivienda habitual declaradas en el IRPF (SERPAVI)." />
        <SeriesCard series={zone.rentalStock} title="Viviendas con alquiler habitual declarado" note="Indicador de profundidad del mercado de alquiler (SERPAVI)." />
        <SeriesCard series={zone.rentIndex} title="Índice de precios del alquiler (IPVA) del municipio" note="Índice INE (no es un precio). Útil para ver la tendencia." />
        <SeriesCard series={zone.priceIndexCcaa} title="Índice de precios de vivienda (IPV) de la comunidad autónoma" note="Compraventas a nivel de comunidad autónoma, no del municipio." />
      </div>
      {zone.unavailable.length > 0 && (
        <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4 text-sm">
          <p className="font-medium text-ink-700">Indicadores no disponibles</p>
          <ul className="mt-2 space-y-1 text-xs text-ink-500">
            {zone.unavailable.map((u) => (
              <li key={u.indicator}>
                <strong className="text-ink-600">{u.indicator}:</strong> {u.reason}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-400">Los datos se muestran a nivel de municipio; no se usan indicadores demográficos como sustituto de la solvencia ni del riesgo de impago u ocupación.</p>
        </div>
      )}
    </div>
  );
}
