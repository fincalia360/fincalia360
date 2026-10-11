"use client";

import { useStudyT } from "@/components/study/StudyI18n";
import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { fmtEur } from "@/services/study/format";
import type { StudyReport } from "@/services/study/reportModel";
import type { ScenarioResult } from "@/services/study/simulator";
import { ORIGIN_LABELS, type AssumptionMeta, type StudyAssumptions } from "@/services/study/types";
import { OriginBadge, ScenarioBars, pct } from "./charts";

type NumKey = {
  [K in keyof StudyAssumptions]: StudyAssumptions[K] extends number | null ? K : never;
}[keyof StudyAssumptions];

const GROUPS: Array<{
  title: string;
  keys: Array<{ key: NumKey; unit: string; step?: number; nullable?: boolean }>;
}> = [
  {
    title: "Mercado",
    keys: [
      { key: "appreciationPct", unit: "%/año", step: 0.5 },
      { key: "rentGrowthPct", unit: "%/año", step: 0.5 },
      { key: "vacancyMonths", unit: "meses/año", step: 0.5 },
      { key: "opportunityRatePct", unit: "%/año", step: 0.5 },
    ],
  },
  {
    title: "Gastos del alquiler",
    keys: [
      { key: "communityFeesYear", unit: "€/año", step: 50, nullable: true },
      { key: "ibiYear", unit: "€/año", step: 50, nullable: true },
      { key: "insuranceYear", unit: "€/año", step: 25, nullable: true },
      { key: "otherCostsYear", unit: "€/año", step: 50 },
      { key: "maintenancePctRent", unit: "% renta", step: 1 },
      { key: "managementPct", unit: "% renta", step: 1 },
      { key: "costInflationPct", unit: "%/año", step: 0.5 },
      { key: "extraordinaryCosts", unit: "€ total", step: 500 },
    ],
  },
  {
    title: "Venta e impuestos",
    keys: [
      { key: "agencyFeePct", unit: "%", step: 0.5 },
      { key: "notaryAndOtherSaleCosts", unit: "€", step: 100 },
      { key: "mortgageCancellationCosts", unit: "€", step: 100 },
      { key: "earlyRepaymentFeePct", unit: "%", step: 0.25 },
      { key: "plusvaliaRatePct", unit: "%", step: 1 },
      { key: "marginalRatePct", unit: "%", step: 1 },
    ],
  },
];

export function AssumptionsEditor({
  values,
  meta,
  onChange,
  onReset,
}: {
  values: StudyAssumptions;
  meta: Record<keyof StudyAssumptions, AssumptionMeta>;
  onChange: (key: keyof StudyAssumptions, value: number | null) => void;
  onReset: () => void;
}) {
  const t = useStudyT();
  const [open, setOpen] = useState(0);
  return (
    <div className="rounded-2xl border border-sand-200 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-sand-100 px-5 py-3">
        <p className="text-sm font-semibold text-ink-800">{t("Hipótesis (modificables)")}</p>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> {t("Restablecer")}
        </Button>
      </div>
      {GROUPS.map((g, gi) => (
        <div key={g.title} className="border-b border-sand-100 last:border-0">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-ink-700 hover:bg-sand-50"
            aria-expanded={open === gi}
            onClick={() => setOpen(open === gi ? -1 : gi)}
          >
            {t(g.title)}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open === gi && "rotate-180")} />
          </button>
          {open === gi && (
            <div className="grid gap-3 px-5 pb-4">
              {g.keys.map(({ key, unit, step, nullable }) => {
                const v = values[key] as number | null;
                return (
                  <div key={key}>
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <label htmlFor={`a-${key}`} className="text-[13px] text-ink-700">
                        {t(meta[key].label)}
                      </label>
                      <OriginBadge origin={meta[key].origin} label={t(ORIGIN_LABELS[meta[key].origin])} />
                    </div>
                    <div className="relative">
                      <input
                        id={`a-${key}`}
                        type="number"
                        step={step}
                        placeholder={nullable ? t("Desconocido") : undefined}
                        value={v == null ? "" : v}
                        onChange={(e) => onChange(key, e.target.value === "" ? (nullable ? null : 0) : Number(e.target.value))}
                        className="field pr-20 tabular-nums"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-400">{t(unit)}</span>
                    </div>
                    {meta[key].note && <p className="mt-0.5 text-[11.5px] text-ink-400">{t(meta[key].note)}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Line({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong ? "border-t border-sand-200 pt-2 font-semibold" : undefined)}>
      <dt className="text-ink-600">{label}</dt>
      <dd className={cn("tabular-nums text-ink-800", warn && "text-amber-700")}>{value}</dd>
    </div>
  );
}

const cell = (v: number | null | undefined) => (v == null ? "No calculable" : fmtEur(v));

export function ScenarioComparison({ report, result }: { report: StudyReport; result: ScenarioResult }) {
  const t = useStudyT();
  const [showYears, setShowYears] = useState(false);
  const b = result.sellNow?.breakdown;
  const h = result.horizon;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-ink-800">{t(h === 1 ? "Patrimonio neto estimado a {0} año" : "Patrimonio neto estimado a {0} años", [h])}</p>
        <p className="mb-4 text-xs text-ink-400">{t("Mismo punto de partida (hoy), mismo horizonte y mismas hipótesis. Euros corrientes del año {0}, sin descontar.", [h])}</p>
        {result.sellNow || result.rentThenSell ? (
          <ScenarioBars
            items={[
              ...(result.sellNow
                ? [
                    {
                      label: t("A · Vender hoy"),
                      value: result.sellNow.wealth,
                      tone: "accent" as const,
                      hint: t("Neto hoy {0} invertido a la rentabilidad alternativa.", [fmtEur(result.sellNow.breakdown.net)]),
                    },
                  ]
                : []),
              ...(result.rentThenSell
                ? [
                    {
                      label: t("B · Alquilar y vender al final"),
                      value: result.rentThenSell.wealth,
                      tone: "ink" as const,
                      hint: t("Flujos del alquiler reinvertidos + dinero neto de la venta futura."),
                    },
                  ]
                : []),
              ...(result.keep
                ? [
                    {
                      label: t("C · Mantener sin vender"),
                      value: result.keep.wealth,
                      tone: "muted" as const,
                      hint: t("Valor bruto {0} − hipoteca {1} + caja {2}. Gastos e impuestos latentes de una venta: {3} (no se restan).", [
                        fmtEur(result.keep.propertyValueGross),
                        fmtEur(result.keep.mortgageBalance),
                        fmtEur(result.keep.accumulatedCash),
                        fmtEur(result.keep.latentSaleCosts),
                      ]),
                    },
                  ]
                : []),
            ]}
          />
        ) : (
          <p className="text-sm text-amber-700">
            {t("No se pueden comparar los escenarios:")}{" "}
            {result.incomplete
              .slice(0, 2)
              .map((x) => t(x))
              .join(" ")}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-soft">
        <p className="border-b border-sand-100 px-5 py-3 text-sm font-semibold text-ink-800">{t("Comparativa a 1, 3, 5 y 10 años")}</p>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t("Horizonte")}</th>
                <th className="text-right">{t("A · Vender")}</th>
                <th className="text-right">{t("B · Alquilar y vender")}</th>
                <th className="text-right">{t("C · Mantener")}</th>
                <th className="text-right">B − A</th>
              </tr>
            </thead>
            <tbody>
              {[1, 3, 5, 10].map((hz) => {
                const r = report.byHorizon[hz];
                const A = r.sellNow?.wealth ?? null;
                const B = r.rentThenSell?.wealth ?? null;
                return (
                  <tr key={hz} className={cn(hz === h && "bg-sand-50 font-medium")}>
                    <td>
                      {hz} {hz === 1 ? t("año") : t("años")}
                    </td>
                    <td className="text-right tabular-nums">{cell(A)}</td>
                    <td className="text-right tabular-nums">{cell(B)}</td>
                    <td className="text-right tabular-nums">{cell(r.keep?.wealth)}</td>
                    <td className={cn("text-right tabular-nums", A != null && B != null && B - A < 0 ? "text-red-700" : "text-pine-600")}>
                      {A != null && B != null ? fmtEur(B - A) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
          <p className="mb-3 text-sm font-semibold text-ink-800">{t("Punto de partida (hoy)")}</p>
          <dl className="space-y-1.5 text-sm">
            <Line label={t("Valor bruto de la vivienda")} value={cell(result.initial.propertyValue)} />
            <Line label={t("Hipoteca pendiente")} value={fmtEur(result.initial.mortgageBalance)} />
            <Line label={t("Patrimonio neto")} value={cell(result.initial.equity)} strong />
          </dl>
        </div>
        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
          <p className="mb-3 text-sm font-semibold text-ink-800">{t("A · Si vendes hoy")}</p>
          {b ? (
            <dl className="space-y-1.5 text-sm">
              <Line label={t("Precio de venta")} value={fmtEur(b.salePrice)} />
              <Line label={t("Gastos de la operación")} value={fmtEur(-b.transactionCosts)} />
              <Line label={t("Plusvalía municipal")} value={b.plusvalia.amount == null ? "No calculable" : fmtEur(-b.plusvalia.amount)} warn={b.plusvalia.amount == null} />
              <Line label={t("Impuesto sobre la ganancia")} value={b.gainTax.amount == null ? "No calculable" : fmtEur(-b.gainTax.amount)} warn={b.gainTax.amount == null} />
              <Line label={t("Hipoteca pendiente")} value={fmtEur(-b.mortgagePayoff)} />
              <Line label={t("Dinero neto que recibirías")} value={fmtEur(b.net)} strong />
              {!b.complete && (
                <p className="pt-1 text-xs text-amber-700">
                  {t("Resultado incompleto:")} {b.notComputed.join("; ") || t("gastos de compra supuestos en 0 €")}.
                </p>
              )}
            </dl>
          ) : (
            <p className="text-sm text-amber-700">{t("Requiere un valor de venta.")}</p>
          )}
        </div>
        <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
          <p className="mb-3 text-sm font-semibold text-ink-800">{t("B y C · Primer año de alquiler")}</p>
          {result.rental ? (
            (() => {
              const y = result.rental.rows[0];
              return (
                <dl className="space-y-1.5 text-sm">
                  <Line label={t("Renta cobrada (tras desocupación)")} value={fmtEur(y.collectedRent)} />
                  <Line label={t("Gastos de explotación")} value={fmtEur(-y.operatingCosts)} />
                  <Line label={t("Cuota hipotecaria (intereses + capital)")} value={fmtEur(-(y.interest + y.principal))} />
                  <Line label={t("Impuestos del alquiler")} value={fmtEur(-y.incomeTax)} />
                  <Line label={t("Flujo de caja neto del año")} value={fmtEur(y.cashFlow)} strong warn={y.cashFlow < 0} />
                  <div className="grid grid-cols-3 gap-2 pt-3 text-center">
                    {[
                      [t("Bruta"), result.yields.gross],
                      [t("Neta"), result.yields.net],
                      [t("Neta tras imp."), result.yields.netAfterTax],
                    ].map(([l, v]) => (
                      <div key={l as string} className="rounded-xl bg-sand-50 p-2">
                        <p className="text-[10.5px] uppercase tracking-wider text-ink-400">{l as string}</p>
                        <p className="font-serif text-lg tabular-nums text-ink-800">{pct(v as number | null)}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-ink-400">{t("Rentabilidades anuales sobre el valor de venta. El flujo de caja no es patrimonio.")}</p>
                </dl>
              );
            })()
          ) : (
            <p className="text-sm text-amber-700">{t("Requiere una renta mensual.")}</p>
          )}
        </div>
      </div>

      {result.rental && (
        <div className="rounded-2xl border border-sand-200 bg-white shadow-soft">
          <button
            type="button"
            onClick={() => setShowYears(!showYears)}
            aria-expanded={showYears}
            className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold text-ink-800"
          >
            {t("Detalle año a año (flujo de caja y patrimonio)")}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showYears && "rotate-180")} />
          </button>
          {showYears && (
            <div className="overflow-x-auto border-t border-sand-100">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>{t("Año")}</th>
                    <th className="text-right">{t("Renta cobrada")}</th>
                    <th className="text-right">{t("Gastos")}</th>
                    <th className="text-right">{t("Hipoteca")}</th>
                    <th className="text-right">{t("Impuestos")}</th>
                    <th className="text-right">{t("Flujo neto")}</th>
                    <th className="text-right">{t("Caja acumulada")}</th>
                    <th className="text-right">{t("Valor vivienda")}</th>
                    <th className="text-right">{t("Deuda")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rental.rows.map((y) => (
                    <tr key={y.year}>
                      <td>{y.year}</td>
                      <td className="text-right tabular-nums">{fmtEur(y.collectedRent)}</td>
                      <td className="text-right tabular-nums">{fmtEur(y.operatingCosts)}</td>
                      <td className="text-right tabular-nums">{fmtEur(y.interest + y.principal)}</td>
                      <td className="text-right tabular-nums">{fmtEur(y.incomeTax)}</td>
                      <td className={cn("text-right tabular-nums", y.cashFlow < 0 && "text-red-700")}>{fmtEur(y.cashFlow)}</td>
                      <td className="text-right tabular-nums">{fmtEur(y.accumulatedCash)}</td>
                      <td className="text-right tabular-nums">{cell(y.propertyValue)}</td>
                      <td className="text-right tabular-nums">{fmtEur(y.mortgageBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
