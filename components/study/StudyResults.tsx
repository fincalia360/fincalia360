"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { fmtEur } from "@/services/study/format";
import { RENT_SOURCE_LABELS, buildStudyReport } from "@/services/study/reportModel";
import { CONFIDENCE_LABELS, HORIZONS, RENT_CHOICES, type AssumptionMeta, type Estimate, type StudyAssumptions, type StudyInput, type StudySnapshot } from "@/services/study/types";
import { ContactForm } from "./ContactForm";
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
  ["valoracion", "Valoración profesional"],
] as const;

function EstimateCard({ title, estimate, unit, extra, hideEmpty }: { title: string; estimate: Estimate | null; unit?: string; extra?: React.ReactNode; hideEmpty?: boolean }) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{title}</p>
        {estimate && <OriginBadge origin={estimate.origin} />}
      </div>
      {estimate ? (
        <>
          <p className="mt-2 font-serif text-[34px] leading-none tabular-nums text-ink-800">
            {eur(estimate.value)}
            {unit && <span className="ml-1 text-base text-ink-400">{unit}</span>}
          </p>
          <p className="mt-1 text-sm tabular-nums text-ink-500">
            Intervalo {eur(estimate.low)} – {eur(estimate.high)} · {eur(estimate.perM2)}/m²
          </p>
          <p className="mt-3 text-xs text-ink-500">{estimate.method}</p>
          <p className="mt-1 text-xs text-ink-400">
            Fuente: {estimate.source.name}
            {estimate.source.period ? ` · ${estimate.source.period}` : ""}
            {estimate.source.retrievedAt ? ` · actualizado ${new Date(estimate.source.retrievedAt).toLocaleDateString("es-ES")}` : ""} · Confianza{" "}
            <strong>{CONFIDENCE_LABELS[estimate.confidence]}</strong>
          </p>
          {estimate.adjustments.length > 0 && (
            <p className="mt-1 text-xs text-ink-400">Ajustes del modelo: {estimate.adjustments.map((a) => `${a.label} ${a.pct > 0 ? "+" : ""}${a.pct} %`).join(", ")}</p>
          )}
          <details className="mt-2 text-xs text-ink-500">
            <summary className="cursor-pointer text-ink-600">Limitaciones</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {estimate.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        </>
      ) : hideEmpty ? null : (
        <p className="mt-3 text-sm text-amber-700">Sin estimación: no hay una fuente fiable con los datos aportados.</p>
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
  valuationRequested,
  ccaaName,
}: {
  studyId: string;
  input: StudyInput;
  snapshot: StudySnapshot;
  initialAssumptions: StudyAssumptions;
  defaultAssumptions: StudyAssumptions;
  meta: Record<keyof StudyAssumptions, AssumptionMeta>;
  valuationRequested: boolean;
  ccaaName: string;
}) {
  const [a, setA] = useState<StudyAssumptions>(initialAssumptions);
  const [horizon, setHorizon] = useState<number>(input.owner.horizon);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "loading" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(JSON.stringify(initialAssumptions));

  // Guardado diferido de las hipótesis (para el informe y el panel del equipo), solo si cambian
  useEffect(() => {
    const body = JSON.stringify(a);
    if (body === lastSaved.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      lastSaved.current = body;
      void fetch(`/api/estudio/${studyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body }).catch(() => {});
    }, 800);
  }, [a, studyId]);

  // Mismo modelo que el PDF: las cifras de la web y del informe coinciden.
  const report = useMemo(() => buildStudyReport(input, snapshot, a, horizon), [input, snapshot, a, horizon]);
  const result = report.main;
  const set = (k: keyof StudyAssumptions, v: unknown) => setA((x) => ({ ...x, [k]: v }));

  async function downloadPdf() {
    setPdfStatus("loading");
    try {
      const res = await fetch(`/api/estudio/${studyId}/informe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ horizon, assumptions: a }) });
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
      <nav aria-label="Secciones del estudio" className="sticky top-16 z-20 -mx-4 overflow-x-auto border-y border-sand-200 bg-sand-50/95 px-4 py-2 backdrop-blur scrollbar-none sm:mx-0 sm:rounded-full sm:border">
        <ul className="flex gap-1 text-[13px]">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block whitespace-nowrap rounded-full px-3 py-1 text-ink-500 hover:bg-white hover:text-ink-800">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* RESUMEN */}
      <section id="resumen" className="scroll-mt-32 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-3xl font-medium text-ink-800">Resumen</h2>
          <Button onClick={downloadPdf} disabled={pdfStatus === "loading"} variant="outline">
            {pdfStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar informe PDF
          </Button>
        </div>
        {pdfStatus === "error" && <p className="text-sm text-red-600">No se pudo generar el PDF. Inténtalo de nuevo.</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EstimateCard
            title="Valor de venta estimado"
            estimate={report.sale.usedSource === "MANUAL" ? null : snapshot.sale}
            hideEmpty={report.sale.usedSource !== "ESTIMATE"}
            extra={
              <div className="mt-4 rounded-xl bg-sand-50 p-3 text-sm">
                {report.sale.usedSource === "NONE" && (
                  <>
                    <p className="text-amber-800">{report.sale.message}</p>
                    <p className="mt-1 text-xs text-ink-500">Sin valor de venta no se calculan el neto de la venta, los escenarios ni una recomendación.</p>
                  </>
                )}
                {report.sale.usedSource === "MANUAL" && (
                  <p className="text-ink-700">
                    Valor usado: <strong className="tabular-nums">{fmtEur(report.sale.used)}</strong> (introducido por ti; no es una tasación).
                  </p>
                )}
                <label className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-700">
                  <input type="checkbox" checked={a.saleChoice === "MANUAL"} onChange={(e) => set("saleChoice", e.target.checked ? "MANUAL" : "AUTO")} />
                  Usar mi propio valor (tasación u oferta)
                </label>
                {a.saleChoice === "MANUAL" && (
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className="field mt-2 tabular-nums"
                    placeholder="Ej.: valor de una tasación reciente"
                    value={a.saleValue ?? ""}
                    onChange={(e) => set("saleValue", e.target.value === "" ? null : Number(e.target.value))}
                    aria-label="Valor de venta manual"
                  />
                )}
              </div>
            }
          />

          <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Alquiler mensual</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-600">
                  Referencia estadística (SERPAVI) {report.rent.statistical && <OriginBadge origin={report.rent.statistical.origin} />}
                </dt>
                <dd className="tabular-nums">{report.rent.statistical ? `${fmtEur(report.rent.statistical.value)}/mes` : "No disponible"}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-600">Estimación de mercado {report.rent.market && <OriginBadge origin={report.rent.market.origin} />}</dt>
                <dd className="tabular-nums">{report.rent.market ? `${fmtEur(report.rent.market.value)}/mes` : "No disponible"}</dd>
              </div>
              {report.rent.ownerCurrent != null && (
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-ink-600">Tu contrato vigente</dt>
                  <dd className="tabular-nums">{fmtEur(report.rent.ownerCurrent)}/mes</dd>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-600">Renta máxima legal aplicable</dt>
                <dd className="tabular-nums">
                  {regime.capMonthly != null ? `${fmtEur(regime.capMonthly)}/mes` : regime.status === "NO_SPECIFIC_CAP" ? "Sin tope específico" : regime.status === "EXISTING_CONTRACT" ? "Contrato vigente" : "No determinada"}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-sand-200 pt-2 font-semibold">
                <dt>Renta usada en la simulación</dt>
                <dd className="tabular-nums">{report.rent.used != null ? `${fmtEur(report.rent.used)}/mes` : "Ninguna"}</dd>
              </div>
            </dl>
            <p className="mt-1 text-xs text-ink-500">
              {RENT_SOURCE_LABELS[report.rent.usedSource]}
              {report.rent.capped ? " · limitada al tope legal" : ""}
            </p>
            <label className="mt-3 block text-[13px] text-ink-700">
              Renta a utilizar
              <select className="field mt-1" value={a.rentChoice} onChange={(e) => set("rentChoice", e.target.value)}>
                {RENT_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {RENT_CHOICE_LABELS[c]}
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
                placeholder="€/mes"
                aria-label="Renta mensual manual"
                value={a.monthlyRent ?? ""}
                onChange={(e) => set("monthlyRent", e.target.value === "" ? null : Number(e.target.value))}
              />
            )}
            <details className="mt-3 text-xs text-ink-500">
              <summary className="cursor-pointer text-ink-600">Régimen legal: {regime.summary}</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {[...regime.rules, ...regime.requirements].map((l) => (
                  <li key={l}>{l}</li>
                ))}
                {regime.missing.map((m) => (
                  <li key={m} className="text-amber-700">
                    Falta: {m}
                  </li>
                ))}
              </ul>
              <p className="mt-1">
                {regime.source.legalBasis}. Zona: {regime.source.scope}
                {regime.source.validFrom ? ` (vigente ${regime.source.validFrom} – ${regime.source.validTo ?? "—"})` : ""} · {regime.source.zoneSource}
              </p>
            </details>
          </div>
        </div>

        {(snapshot.saleAlternatives.length > 0 || snapshot.rentAlternatives.length > 0) && (
          <details className="rounded-2xl border border-sand-200 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-medium text-ink-700">Otras estimaciones disponibles ({snapshot.saleAlternatives.length + snapshot.rentAlternatives.length})</summary>
            <ul className="mt-3 space-y-2">
              {[...snapshot.saleAlternatives.map((e) => ["Venta", e] as const), ...snapshot.rentAlternatives.map((e) => ["Alquiler", e] as const)].map(([k, e], i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-500">{k}:</span>
                  <strong className="tabular-nums">{eur(e.value)}</strong>
                  <OriginBadge origin={e.origin} />
                  <span className="text-xs text-ink-400">{e.method}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Neto si vendes hoy", result.sellNow ? fmtEur(result.sellNow.breakdown.net) + (result.sellNow.breakdown.complete ? "" : " *") : "No calculable"],
            ["Flujo de caja anual (año 1)", y1 ? fmtEur(y1.cashFlow) : "No calculable"],
            ["Rentabilidad bruta anual", pct(result.yields.gross)],
            ["Neta tras impuestos anual", pct(result.yields.netAfterTax)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
              <p className="text-[11px] uppercase tracking-wider text-ink-400">{l}</p>
              <p className="mt-1 font-serif text-2xl tabular-nums text-ink-800">{v}</p>
            </div>
          ))}
        </div>
        {result.sellNow && !result.sellNow.breakdown.complete && (
          <p className="text-xs text-amber-700">* Neto incompleto: {result.sellNow.breakdown.notComputed.join("; ") || "faltan datos fiscales"}.</p>
        )}
        <TensionedBanner t={snapshot.tensioned} />
        {snapshot.comparables.serpaviBand && (
          <p className="rounded-xl bg-white p-4 text-sm text-ink-600 shadow-soft">
            <strong className="text-ink-800">Comparación con viviendas similares:</strong> en {input.location.municipalityName}, el alquiler declarado de{" "}
            {snapshot.comparables.serpaviBand.typology === "VC" ? "pisos" : "viviendas unifamiliares"} en {snapshot.comparables.serpaviBand.year} fue de{" "}
            {snapshot.comparables.serpaviBand.p25.toLocaleString("es-ES")}–{snapshot.comparables.serpaviBand.p75.toLocaleString("es-ES")} €/m² al mes (P25–P75, mediana{" "}
            {snapshot.comparables.serpaviBand.median.toLocaleString("es-ES")} €/m², {snapshot.comparables.serpaviBand.count} viviendas, superficie mediana{" "}
            {snapshot.comparables.serpaviBand.medianSqm} m²). {snapshot.comparables.note}
          </p>
        )}
        <div className={cn("rounded-2xl border p-5", report.conclusive ? "border-ink-100 bg-ink-50" : "border-amber-200 bg-amber-50")}>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Lo que dicen los escenarios</p>
          <p className="mt-2 font-medium text-ink-800">{report.headline}</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-600">
            {report.points.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
          {report.uncertainties.length > 0 && (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Principales incertidumbres</p>
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
            <h2 className="font-serif text-3xl font-medium text-ink-800">Vender frente a alquilar</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-500">Modifica las hipótesis y los resultados se recalculan al instante. Ninguna subida de precios está garantizada.</p>
          </div>
          <div className="flex rounded-full border border-sand-300 bg-white p-0.5" role="tablist" aria-label="Horizonte">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                role="tab"
                aria-selected={horizon === h}
                onClick={() => setHorizon(h)}
                className={cn("rounded-full px-3 py-1.5 text-[13px] tabular-nums", horizon === h ? "bg-ink-800 text-white" : "text-ink-500 hover:text-ink-800")}
              >
                {h} {h === 1 ? "año" : "años"}
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
            Sensibilidad: cómo cambia la diferencia B − A a {horizon} {horizon === 1 ? "año" : "años"}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th className="text-right">A la baja</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">Al alza</th>
                  <th className="w-40">Impacto</th>
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
                            <div className="h-full rounded-full bg-terracotta-500" style={{ width: `${((d.impact ?? 0) / maxImpact) * 100}%` }} />
                          </div>
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className="whitespace-normal text-xs text-amber-700">
                        No calculable: {d.reason}
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
        <h2 className="font-serif text-3xl font-medium text-ink-800">Escenarios adversos del alquiler</h2>
        <RiskPanel report={report} onChange={(k, v) => set(k, v)} propertyEmptyOrSecond={["EMPTY", "SECOND_HOME"].includes(input.property.currentUse)} />
      </section>

      {/* IMPUESTOS */}
      <section id="impuestos" className="scroll-mt-32 space-y-4">
        <h2 className="font-serif text-3xl font-medium text-ink-800">Impuestos, herencias y planificación</h2>
        <TaxPanel report={report} input={input} ccaaName={ccaaName} onChange={(k, v) => set(k, v)} />
      </section>

      {/* ZONA */}
      <section id="zona" className="scroll-mt-32 space-y-4">
        <h2 className="font-serif text-3xl font-medium text-ink-800">Análisis de la zona</h2>
        <ZonePanel zone={snapshot.zone} municipality={input.location.municipalityName} />
      </section>

      {/* FUENTES */}
      <section id="fuentes" className="scroll-mt-32 space-y-4">
        <h2 className="font-serif text-3xl font-medium text-ink-800">Fuentes y limitaciones</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold text-ink-800">Fuentes consultadas</p>
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
                      {{ OK: "Consultada", STALE: "Copia guardada (fuente no disponible ahora)", ERROR: "Error al consultar", NOT_CONFIGURED: "No configurada", NOT_AVAILABLE: "Sin datos" }[s.status]}
                      {s.period ? ` · periodo ${s.period}` : ""}
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
                <p className="text-sm font-semibold text-ink-800">Datos que mejorarían el estudio</p>
                <ul className="mt-2 space-y-1 text-sm text-ink-600">
                  {snapshot.missingData.map((m) => (
                    <li key={m}>· {m}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-2xl border border-sand-200 bg-white p-5 text-sm text-ink-600 shadow-soft">
              <p className="flex items-center gap-2 font-semibold text-ink-800">
                <Info className="h-4 w-4" /> Cómo leer los datos
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["OFFICIAL", "OWNER", "MARKET_OBSERVED", "MODEL", "ASSUMPTION", "EXAMPLE"] as const).map((o) => (
                  <OriginBadge key={o} origin={o} />
                ))}
              </div>
              <p className="mt-3 text-xs">
                Los precios de anuncio nunca se presentan como precios de compraventa cerrados. Este estudio es orientativo y no sustituye una valoración profesional ni el
                asesoramiento financiero, fiscal o jurídico.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CAPTACIÓN */}
      <section id="valoracion" className="scroll-mt-32">
        <div className="rounded-3xl border border-sand-200 bg-white p-6 shadow-soft sm:p-10">
          <h2 className="max-w-2xl font-serif text-3xl font-medium text-ink-800 sm:text-4xl">
            Descubre cuánto dinero podrías obtener por tu vivienda y compara esa cantidad con lo que podrías ganar manteniéndola en alquiler
          </h2>
          <p className="mt-3 max-w-2xl text-ink-500">
            Un especialista local revisa tu estudio, visita la vivienda y afina el precio de venta y el alquiler de mercado. Gratis y sin compromiso. El estudio y el informe PDF son
            tuyos tanto si lo solicitas como si no.
          </p>
          <div className="mt-6">
            <ContactForm studyId={studyId} alreadyRequested={valuationRequested} />
          </div>
        </div>
      </section>
    </div>
  );
}
