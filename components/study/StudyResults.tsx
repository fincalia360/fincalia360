"use client";

import { useStudyT } from "@/components/study/StudyI18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PropertyMapsPanel } from "./PropertyMapsPanel";
import { cn } from "@/lib/utils";
import { fmtEur } from "@/services/study/format";
import { RENT_SOURCE_LABELS, buildStudyReport } from "@/services/study/reportModel";
import {
  CONFIDENCE_LABELS,
  HORIZONS,
  ORIGIN_LABELS,
  PROPERTY_KIND_LABELS,
  RENT_CHOICES,
  type AssumptionMeta,
  type Estimate,
  type StudyAssumptions,
  type StudyInput,
  type StudySnapshot,
} from "@/services/study/types";
import { NextStepPanel, type PublicService } from "./NextStepPanel";
import { StudyChat } from "./StudyChat";
import { OriginBadge, eur, pct } from "./charts";
import { RiskPanel } from "./RiskPanel";
import { AssumptionsEditor, ScenarioComparison } from "./SimulatorPanel";
import { TaxPanel } from "./TaxPanel";
import { TensionedBanner, ZonePanel } from "./ZonePanel";

const SECTIONS = [
  ["resumen", "Resumen"],
  ["simulador", "Vender o alquilar"],
  ["impagos", "Impagos"],
  ["impuestos", "Impuestos"],
  ["zona", "Zona"],
  ["fuentes", "Fuentes"],
  ["valoracion", "Siguiente paso"],
] as const;

function EstimateCard({ title, estimate, unit, extra, hideEmpty }: { title: string; estimate: Estimate | null; unit?: string; extra?: React.ReactNode; hideEmpty?: boolean }) {
  const t = useStudyT();
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{title}</p>
        {estimate && <OriginBadge origin={estimate.origin} label={t(ORIGIN_LABELS[estimate.origin])} />}
      </div>
      {estimate ? (
        <>
          <p className="mt-2 font-serif text-[34px] leading-none tabular-nums text-ink-800">
            {eur(estimate.value)}
            {unit && <span className="ml-1 text-base text-ink-400">{unit}</span>}
          </p>
          <p className="mt-1 text-sm tabular-nums text-ink-500">
            {t("Intervalo")} {eur(estimate.low)} – {eur(estimate.high)} · {eur(estimate.perM2)}/m²
          </p>
          <p className="mt-3 text-xs text-ink-500">{estimate.method}</p>
          <p className="mt-1 text-xs text-ink-400">
            {t("Fuente:")} {estimate.source.name}
            {estimate.source.period ? ` · ${estimate.source.period}` : ""}
            {estimate.source.retrievedAt ? t(" · actualizado {0}", [new Date(estimate.source.retrievedAt).toLocaleDateString("es-ES")]) : ""} {t("· Confianza")}{" "}
            <strong>{t(CONFIDENCE_LABELS[estimate.confidence])}</strong>
          </p>
          {estimate.adjustments.length > 0 && (
            <p className="mt-1 text-xs text-ink-400">
              {t("Ajustes del modelo:")} {estimate.adjustments.map((a) => `${a.label} ${a.pct > 0 ? "+" : ""}${a.pct} %`).join(", ")}
            </p>
          )}
          {estimate.annexes && estimate.annexes.length > 0 && (
            <div className="mt-3 rounded-xl bg-sand-50 p-3 text-xs">
              <p className="font-semibold text-ink-700">{t("Desglose")}</p>
              <ul className="mt-1.5 space-y-1.5">
                {estimate.dwellingValue != null && (
                  <li className="flex justify-between gap-3">
                    <span className="text-ink-600">{t("Vivienda")}</span>
                    <span className="font-medium tabular-nums text-ink-800">{eur(estimate.dwellingValue)}</span>
                  </li>
                )}
                {estimate.annexes.map((an) => (
                  <li key={an.label}>
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-600">
                        {an.label} {an.value != null && <OriginBadge origin={an.origin} label={t(ORIGIN_LABELS[an.origin])} />}
                      </span>
                      <span className={cn("font-medium tabular-nums", an.value == null ? "text-amber-700" : "text-ink-800")}>
                        {an.value == null ? t("Sin valorar") : eur(an.value)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-ink-400">{an.method}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details className="mt-2 text-xs text-ink-500">
            <summary className="cursor-pointer text-ink-600">{t("Limitaciones")}</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {estimate.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        </>
      ) : hideEmpty ? null : (
        <p className="mt-3 text-sm text-amber-700">{t("Sin estimación: no hay una fuente fiable con los datos aportados.")}</p>
      )}
      {extra}
    </div>
  );
}

const RENT_CHOICE_LABELS: Record<StudyAssumptions["rentChoice"], string> = {
  AUTO: "Automática (contrato vigente › mercado › estadística)",
  OWNER_CURRENT: RENT_SOURCE_LABELS.OWNER_CURRENT,
  MARKET: RENT_SOURCE_LABELS.MARKET,
  STATISTICAL: RENT_SOURCE_LABELS.STATISTICAL,
  LEGAL_CAP: RENT_SOURCE_LABELS.LEGAL_CAP,
  MANUAL: RENT_SOURCE_LABELS.MANUAL,
};

export function StudyResults({
  studyId,
  input,
  snapshot,
  initialAssumptions,
  defaultAssumptions,
  meta,
  ccaaName,
  services,
  emailConfigured,
  chatEnabled,
  chatDemo = false,
  initialClientName = null,
}: {
  studyId: string;
  input: StudyInput;
  snapshot: StudySnapshot;
  initialAssumptions: StudyAssumptions;
  defaultAssumptions: StudyAssumptions;
  meta: Record<keyof StudyAssumptions, AssumptionMeta>;
  ccaaName: string;
  /** Nombre guardado para la portada del PDF (opcional). */
  initialClientName?: string | null;
  services: PublicService[];
  emailConfigured: boolean;
  chatEnabled: boolean;
  chatDemo?: boolean;
}) {
  const t = useStudyT();
  const [a, setA] = useState<StudyAssumptions>(initialAssumptions);
  const [horizon, setHorizon] = useState<number>(input.owner.horizon);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "loading" | "error">("idle");
  const [clientName, setClientName] = useState(initialClientName ?? "");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(JSON.stringify(initialAssumptions));

  // Guardado diferido de las hipótesis (para el informe y el panel del equipo), solo si cambian
  useEffect(() => {
    const body = JSON.stringify(a);
    if (body === lastSaved.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      lastSaved.current = body;
      void fetch(`/api/estudio/${studyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {});
    }, 800);
  }, [a, studyId]);

  // Mismo modelo que el PDF: las cifras de la web y del informe coinciden.
  const report = useMemo(() => buildStudyReport(input, snapshot, a, horizon), [input, snapshot, a, horizon]);
  const result = report.main;
  const set = (k: keyof StudyAssumptions, v: unknown) => setA((x) => ({ ...x, [k]: v }));

  async function downloadPdf() {
    setPdfStatus("loading");
    try {
      const res = await fetch(`/api/estudio/${studyId}/informe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon, assumptions: a, clientName }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "estudio-vender-o-alquilar.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPdfStatus("idle");
    } catch {
      setPdfStatus("error");
    }
  }

  const warnings = [...report.snapshotWarnings, ...result.warnings, ...report.rent.notes].filter((w) => !report.uncertainties.includes(w));
  const regime = report.rent.regime;
  const y1 = result.rental?.rows[0];
  const maxImpact = Math.max(1, ...report.sensitivity.filter((d) => d.available).map((d) => d.impact ?? 0));

  return (
    <div className="space-y-12">
      <nav
        aria-label={t("Secciones del estudio")}
        className="sticky top-16 z-20 -mx-4 overflow-x-auto border-y border-sand-200 bg-sand-50/95 px-4 py-2 backdrop-blur scrollbar-none sm:mx-0 sm:rounded-full sm:border"
      >
        <ul className="flex gap-1 text-[13px]">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block whitespace-nowrap rounded-full px-3 py-1 text-ink-500 hover:bg-white hover:text-ink-800">
                {t(label)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* RESUMEN */}
      <section id="resumen" className="scroll-mt-32 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-3xl font-medium text-ink-800">{t("Resumen")}</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-ink-500">{t("Nombre para la portada (opcional)")}</span>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                maxLength={120}
                autoComplete="name"
                placeholder={t("Nombre y apellidos")}
                className="field h-10 w-60 py-0 text-sm"
              />
            </label>
            <Button onClick={downloadPdf} disabled={pdfStatus === "loading"} variant="outline">
              {pdfStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("Descargar informe PDF")}
            </Button>
          </div>
        </div>
        {pdfStatus === "error" && <p className="text-sm text-red-600">{t("No se pudo generar el PDF. Inténtalo de nuevo.")}</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EstimateCard
            title={t("Valor de venta estimado")}
            estimate={report.sale.usedSource === "MANUAL" ? null : snapshot.sale}
            hideEmpty={report.sale.usedSource !== "ESTIMATE"}
            extra={
              <div className="mt-4 rounded-xl bg-sand-50 p-3 text-sm">
                {report.sale.usedSource === "NONE" && (
                  <>
                    <p className="text-amber-800">{report.sale.message}</p>
                    <p className="mt-1 text-xs text-ink-500">{t("Sin valor de venta no se calculan el neto de la venta, los escenarios ni una recomendación.")}</p>
                  </>
                )}
                {report.sale.usedSource === "MANUAL" && (
                  <p className="text-ink-700">
                    {t("Valor usado:")} <strong className="tabular-nums">{fmtEur(report.sale.used)}</strong> {t("(introducido por ti; no es una tasación).")}
                  </p>
                )}
                <label className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-700">
                  <input type="checkbox" checked={a.saleChoice === "MANUAL"} onChange={(e) => set("saleChoice", e.target.checked ? "MANUAL" : "AUTO")} />
                  {t("Usar mi propio valor (tasación u oferta)")}
                </label>
                {a.saleChoice === "MANUAL" && (
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className="field mt-2 tabular-nums"
                    placeholder={t("Ej.: valor de una tasación reciente")}
                    value={a.saleValue ?? ""}
                    onChange={(e) => set("saleValue", e.target.value === "" ? null : Number(e.target.value))}
                    aria-label={t("Valor de venta manual")}
                  />
                )}
              </div>
            }
          />

          <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{t("Alquiler mensual")}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-600">
                  {t("Referencia estadística (SERPAVI)")}{" "}
                  {report.rent.statistical && <OriginBadge origin={report.rent.statistical.origin} label={t(ORIGIN_LABELS[report.rent.statistical.origin])} />}
                </dt>
                <dd className="tabular-nums">{report.rent.statistical ? `${fmtEur(report.rent.statistical.value)}${t("/mes")}` : t("No disponible")}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-600">
                  {t("Estimación de mercado")} {report.rent.market && <OriginBadge origin={report.rent.market.origin} label={t(ORIGIN_LABELS[report.rent.market.origin])} />}
                </dt>
                <dd className="tabular-nums">{report.rent.market ? `${fmtEur(report.rent.market.value)}${t("/mes")}` : t("No disponible")}</dd>
              </div>
              {report.rent.ownerCurrent != null && (
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-ink-600">{t("Tu contrato vigente")}</dt>
                  <dd className="tabular-nums">
                    {fmtEur(report.rent.ownerCurrent)}
                    {t("/mes")}
                  </dd>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-600">{t("Renta máxima legal aplicable")}</dt>
                <dd className="tabular-nums">
                  {regime.capMonthly != null
                    ? `${fmtEur(regime.capMonthly)}${t("/mes")}`
                    : regime.status === "NO_SPECIFIC_CAP"
                      ? t("Sin tope específico")
                      : regime.status === "EXISTING_CONTRACT"
                        ? t("Contrato vigente")
                        : t("No determinada")}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-sand-200 pt-2 font-semibold">
                <dt>{t("Renta usada en la simulación")}</dt>
                <dd className="tabular-nums">{report.rent.used != null ? `${fmtEur(report.rent.used)}${t("/mes")}` : t("Ninguna")}</dd>
              </div>
            </dl>
            <p className="mt-1 text-xs text-ink-500">
              {t(RENT_SOURCE_LABELS[report.rent.usedSource])}
              {report.rent.capped ? t(" · limitada al tope legal") : ""}
            </p>
            <label className="mt-3 block text-[13px] text-ink-700">
              {t("Renta a utilizar")}
              <select className="field mt-1" value={a.rentChoice} onChange={(e) => set("rentChoice", e.target.value)}>
                {RENT_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {t(RENT_CHOICE_LABELS[c])}
                  </option>
                ))}
              </select>
            </label>
            {a.rentChoice === "MANUAL" && (
              <input
                type="number"
                min={0}
                step={25}
                className="field mt-2 tabular-nums"
                placeholder={t("€/mes")}
                aria-label={t("Renta mensual manual")}
                value={a.monthlyRent ?? ""}
                onChange={(e) => set("monthlyRent", e.target.value === "" ? null : Number(e.target.value))}
              />
            )}
            <details className="mt-3 text-xs text-ink-500">
              <summary className="cursor-pointer text-ink-600">
                {t("Régimen legal:")} {regime.summary}
              </summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {[...regime.rules, ...regime.requirements].map((l) => (
                  <li key={l}>{l}</li>
                ))}
                {regime.missing.map((m) => (
                  <li key={m} className="text-amber-700">
                    {t("Falta:")} {m}
                  </li>
                ))}
              </ul>
              <p className="mt-1">
                {regime.source.legalBasis}
                {t(". Zona:")} {regime.source.scope}
                {regime.source.validFrom ? t(" (vigente {0} – {1})", [regime.source.validFrom, regime.source.validTo ?? "—"]) : ""} · {regime.source.zoneSource}
              </p>
            </details>
          </div>
        </div>

        {(snapshot.saleAlternatives.length > 0 || snapshot.rentAlternatives.length > 0) && (
          <details className="rounded-2xl border border-sand-200 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-medium text-ink-700">
              {t("Otras estimaciones disponibles ({0})", [snapshot.saleAlternatives.length + snapshot.rentAlternatives.length])}
            </summary>
            <ul className="mt-3 space-y-2">
              {[...snapshot.saleAlternatives.map((e) => [t("Venta"), e] as const), ...snapshot.rentAlternatives.map((e) => [t("Alquiler"), e] as const)].map(([k, e], i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-500">{k}:</span>
                  <strong className="tabular-nums">{eur(e.value)}</strong>
                  <OriginBadge origin={e.origin} label={t(ORIGIN_LABELS[e.origin])} />
                  <span className="text-xs text-ink-400">{e.method}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [t("Neto si vendes hoy"), result.sellNow ? fmtEur(result.sellNow.breakdown.net) + (result.sellNow.breakdown.complete ? "" : " *") : t("No calculable")],
            [t("Flujo de caja anual (año 1)"), y1 ? fmtEur(y1.cashFlow) : t("No calculable")],
            [t("Rentabilidad bruta anual"), pct(result.yields.gross)],
            [t("Neta tras impuestos anual"), pct(result.yields.netAfterTax)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
              <p className="text-[11px] uppercase tracking-wider text-ink-400">{l}</p>
              <p className="mt-1 font-serif text-2xl tabular-nums text-ink-800">{v}</p>
            </div>
          ))}
        </div>
        {result.sellNow && !result.sellNow.breakdown.complete && (
          <p className="text-xs text-amber-700">
            {t("* Neto incompleto:")} {result.sellNow.breakdown.notComputed.join("; ") || t("faltan datos fiscales")}.
          </p>
        )}
        <TensionedBanner t={snapshot.tensioned} />
        {snapshot.comparables.serpaviBand && (
          <p className="rounded-xl bg-white p-4 text-sm text-ink-600 shadow-soft">
            <strong className="text-ink-800">{t("Comparación con viviendas similares:")}</strong>{" "}
            {t(
              snapshot.comparables.serpaviBand.typology === "VC"
                ? "en {0}, el alquiler declarado de pisos en {1} fue de {2}–{3} €/m² al mes (P25–P75, mediana {4} €/m², {5} viviendas, superficie mediana {6} m²)."
                : "en {0}, el alquiler declarado de viviendas unifamiliares en {1} fue de {2}–{3} €/m² al mes (P25–P75, mediana {4} €/m², {5} viviendas, superficie mediana {6} m²).",
              [
                input.location.municipalityName,
                snapshot.comparables.serpaviBand.year,
                snapshot.comparables.serpaviBand.p25.toLocaleString("es-ES"),
                snapshot.comparables.serpaviBand.p75.toLocaleString("es-ES"),
                snapshot.comparables.serpaviBand.median.toLocaleString("es-ES"),
                snapshot.comparables.serpaviBand.count,
                snapshot.comparables.serpaviBand.medianSqm,
              ],
            )}{" "}
            {t(snapshot.comparables.note)}
          </p>
        )}
        <div className={cn("rounded-2xl border p-5", report.conclusive ? "border-ink-100 bg-ink-50" : "border-amber-200 bg-amber-50")}>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t("Lo que dicen los escenarios")}</p>
          <p className="mt-2 font-medium text-ink-800">{report.headline}</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-600">
            {report.points.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
          {report.uncertainties.length > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("Principales incertidumbres")}</p>
              <ul className="mt-1 space-y-1 text-sm text-ink-600">
                {report.uncertainties.slice(0, 6).map((u) => (
                  <li key={u}>· {u}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {[...new Set(warnings)].map((w) => (
              <li key={w} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* SIMULADOR */}
      <section id="simulador" className="scroll-mt-32 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl font-medium text-ink-800">{t("Vender frente a alquilar")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-500">
              {t("Modifica las hipótesis y los resultados se recalculan al instante. Ninguna subida de precios está garantizada.")}
            </p>
          </div>
          <div className="flex rounded-full border border-sand-300 bg-white p-0.5" role="tablist" aria-label={t("Horizonte")}>
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                role="tab"
                aria-selected={horizon === h}
                onClick={() => setHorizon(h)}
                className={cn("rounded-full px-3 py-1.5 text-[13px] tabular-nums", horizon === h ? "bg-ink-800 text-white" : "text-ink-500 hover:text-ink-800")}
              >
                {h} {h === 1 ? t("año") : t("años")}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
          <div className="lg:sticky lg:top-32">
            <AssumptionsEditor values={a} meta={meta} onChange={(k, v) => set(k, v)} onReset={() => setA(defaultAssumptions)} />
          </div>
          <ScenarioComparison report={report} result={result} />
        </div>
        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-ink-800">
            {t("Sensibilidad: cómo cambia la diferencia B − A a")} {horizon} {horizon === 1 ? t("año") : t("años")}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t("Variable")}</th>
                  <th className="text-right">{t("A la baja")}</th>
                  <th className="text-right">{t("Base")}</th>
                  <th className="text-right">{t("Al alza")}</th>
                  <th className="w-40">{t("Impacto")}</th>
                </tr>
              </thead>
              <tbody>
                {report.sensitivity.map((d) => (
                  <tr key={d.key}>
                    <td className="whitespace-normal">{d.label}</td>
                    {d.available ? (
                      <>
                        <td className="text-right tabular-nums">{fmtEur(d.down)}</td>
                        <td className="text-right tabular-nums">{fmtEur(d.base)}</td>
                        <td className="text-right tabular-nums">{fmtEur(d.up)}</td>
                        <td>
                          <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                            <div
                              className="h-full rounded-full bg-terracotta-500"
                              style={{
                                width: `${((d.impact ?? 0) / maxImpact) * 100}%`,
                              }}
                            />
                          </div>
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className="whitespace-normal text-xs text-amber-700">
                        {t("No calculable:")} {d.reason}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* IMPAGOS */}
      <section id="impagos" className="scroll-mt-32 space-y-4">
        <h2 className="font-serif text-3xl font-medium text-ink-800">{t("Escenarios adversos del alquiler")}</h2>
        <RiskPanel report={report} onChange={(k, v) => set(k, v)} propertyEmptyOrSecond={["EMPTY", "SECOND_HOME"].includes(input.property.currentUse)} />
      </section>

      {/* IMPUESTOS */}
      <section id="impuestos" className="scroll-mt-32 space-y-4">
        <h2 className="font-serif text-3xl font-medium text-ink-800">{t("Impuestos, herencias y planificación")}</h2>
        <TaxPanel report={report} input={input} ccaaName={ccaaName} onChange={(k, v) => set(k, v)} />
      </section>

      {/* ZONA */}
      <section id="zona" className="scroll-mt-32 space-y-4">
        <h2 className="font-serif text-3xl font-medium text-ink-800">{t("Análisis de la zona")}</h2>
        <PropertyMapsPanel studyId={studyId} hasCadastralRef={Boolean(input.location.cadastralRef)} valueZone={snapshot.valueZone} />
        <ZonePanel zone={snapshot.zone} municipality={input.location.municipalityName} />
      </section>

      {/* FUENTES */}
      <section id="fuentes" className="scroll-mt-32 space-y-4">
        <h2 className="font-serif text-3xl font-medium text-ink-800">{t("Fuentes y limitaciones")}</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold text-ink-800">{t("Fuentes consultadas")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {[...new Map(snapshot.sources.map((s) => [`${s.name}|${s.status}`, s])).values()].map((s) => (
                <li key={`${s.name}-${s.status}`} className="flex gap-2">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", s.status === "OK" ? "bg-pine-500" : s.status === "STALE" ? "bg-amber-500" : "bg-ink-300")} />
                  <span>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-ink-800 underline-offset-2 hover:underline">
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}
                    <span className="block text-xs text-ink-400">
                      {
                        {
                          OK: "Consultada",
                          STALE: "Copia guardada (fuente no disponible ahora)",
                          ERROR: "Error al consultar",
                          NOT_CONFIGURED: "No configurada",
                          NOT_AVAILABLE: "Sin datos",
                        }[s.status]
                      }
                      {s.period ? t(" · periodo {0}", [s.period]) : ""}
                      {s.retrievedAt ? ` · ${new Date(s.retrievedAt).toLocaleDateString("es-ES")}` : ""}
                      {s.note ? ` · ${s.note}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            {snapshot.missingData.length > 0 && (
              <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
                <p className="text-sm font-semibold text-ink-800">{t("Datos que mejorarían el estudio")}</p>
                <ul className="mt-2 space-y-1 text-sm text-ink-600">
                  {snapshot.missingData.map((m) => (
                    <li key={m}>· {m}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-2xl border border-sand-200 bg-white p-5 text-sm text-ink-600 shadow-soft">
              <p className="flex items-center gap-2 font-semibold text-ink-800">
                <Info className="h-4 w-4" /> {t("Cómo leer los datos")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["OFFICIAL", "OWNER", "MARKET_OBSERVED", "MODEL", "ASSUMPTION", "EXAMPLE"] as const).map((o) => (
                  <OriginBadge key={o} origin={o} label={t(ORIGIN_LABELS[o])} />
                ))}
              </div>
              <p className="mt-3 text-xs">
                {t(
                  "Los precios de anuncio nunca se presentan como precios de compraventa cerrados. Este estudio es orientativo y no sustituye una valoración profesional ni el asesoramiento financiero, fiscal o jurídico.",
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SIGUIENTE PASO (captación voluntaria; todos los resultados ya se han mostrado) */}
      <section id="valoracion" className="scroll-mt-32">
        <NextStepPanel
          studyId={studyId}
          property={{
            municipality: input.location.municipalityName,
            kind: t(PROPERTY_KIND_LABELS[input.property.kind]),
            sqm: input.property.sqm,
          }}
          services={services}
          emailConfigured={emailConfigured}
          onDownload={downloadPdf}
          downloading={pdfStatus === "loading"}
        />
        {pdfStatus === "error" && <p className="mt-3 text-sm text-red-600">{t("No se pudo generar el PDF. Inténtalo de nuevo.")}</p>}
      </section>
      {chatEnabled && <StudyChat studyId={studyId} demo={chatDemo} />}
    </div>
  );
}
