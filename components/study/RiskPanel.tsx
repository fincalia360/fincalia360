"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtEur } from "@/services/study/format";
import type { StudyReport } from "@/services/study/reportModel";
import { RISK_DISCLAIMER, RISK_INFO, RISK_MONTHS, RISK_TYPES, riskLegalKey, riskRepairsKey, type RiskType } from "@/services/study/risk";
import type { StudyAssumptions } from "@/services/study/types";

export function RiskPanel({
  report,
  onChange,
  propertyEmptyOrSecond,
}: {
  report: StudyReport;
  onChange: (key: keyof StudyAssumptions, value: number) => void;
  propertyEmptyOrSecond: boolean;
}) {
  const [type, setType] = useState<RiskType>("ARREARS");
  const [monthsIdx, setMonthsIdx] = useState(1);
  const a = report.assumptions;
  if (!report.risk) return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No se pueden calcular escenarios de impago sin una renta mensual.</p>;
  const row = report.risk.rows.find((x) => x.type === type)!;
  const r = row.results[monthsIdx];
  const info = RISK_INFO[type];

  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de situación">
        {RISK_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={cn("rounded-full border px-3 py-1.5 text-[13px]", type === t ? "border-ink-800 bg-ink-800 text-white" : "border-sand-300 text-ink-600 hover:border-ink-300")}
          >
            {RISK_INFO[t].title}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-700">{info.description}</p>
      <p className="mt-1 text-xs text-ink-500">{info.legal}</p>
      {type === "SQUATTING" && !propertyEmptyOrSecond && (
        <p className="mt-2 text-xs text-amber-700">Con un inquilino con contrato se trataría de un impago, no de una ocupación sin título.</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-ink-600">Duración supuesta:</span>
        {RISK_MONTHS.map((m, i) => (
          <button
            key={m}
            type="button"
            aria-pressed={monthsIdx === i}
            onClick={() => setMonthsIdx(i)}
            className={cn("rounded-lg border px-3 py-1 text-sm tabular-nums", monthsIdx === i ? "border-terracotta-500 bg-terracotta-50 text-terracotta-700" : "border-sand-300 text-ink-600")}
          >
            {m} meses
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <dl className="space-y-1.5 text-sm">
          {[
            [type === "SQUATTING" ? "Renta de mercado no obtenida" : "Alquiler no cobrado", r.unpaidRent],
            ["Fianza aplicada a la deuda", -r.depositApplied],
            ["Meses hasta volver a alquilar", r.reletLoss],
            ["= Ingresos perdidos", r.lostIncome],
            ["Gastos ordinarios que sigues pagando", r.ordinaryExpenses],
            ["Gastos jurídicos (hipótesis)", r.legalCosts],
            ["Reparaciones (hipótesis)", r.repairs],
            ["Otros costes (intereses y coste de oportunidad)", r.otherCosts],
          ].map(([l, v]) => (
            <div key={l as string} className={cn("flex justify-between gap-3", (l as string).startsWith("=") && "border-b border-sand-200 pb-1.5 font-medium")}>
              <dt className="text-ink-600">{(l as string).replace(/^= /, "")}</dt>
              <dd className="tabular-nums text-ink-800">{fmtEur(v as number)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-sand-200 pt-2 font-semibold">
            <dt>Coste total del periodo</dt>
            <dd className="tabular-nums text-red-700">{fmtEur(r.total)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-ink-600">
            <dt>Coste adicional frente a un alquiler normal</dt>
            <dd className="tabular-nums">{fmtEur(r.incrementalCost)}</dd>
          </div>
          <p className="pt-1 text-xs text-ink-400">
            {r.note} El coste total es el dinero que sale de tu bolsillo durante el periodo; el coste adicional excluye los gastos ordinarios e intereses, que pagarías igualmente.
          </p>
        </dl>
        <div className="space-y-3 rounded-xl bg-sand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Hipótesis manuales (se usan también en el PDF)</p>
          {[
            [riskLegalKey(type), "Gastos jurídicos (abogado, procurador…)"],
            [riskRepairsKey(type), "Reparaciones y daños"],
            ["riskReletMonths", "Meses hasta volver a alquilar"],
            ["riskDepositMonths", "Fianza y garantías (meses de renta)"],
          ].map(([key, label]) => (
            <label key={key} className="block text-[13px] text-ink-700">
              {label}
              <input type="number" min={0} className="field mt-1" value={a[key as keyof StudyAssumptions] as number} onChange={(e) => onChange(key as keyof StudyAssumptions, Number(e.target.value) || 0)} />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Coste total estimado</th>
              {RISK_MONTHS.map((m) => (
                <th key={m} className="text-right">
                  {m} meses
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.risk.rows.map((rw) => (
              <tr key={rw.type}>
                <td className="whitespace-normal">{RISK_INFO[rw.type].title}</td>
                {rw.results.map((x) => (
                  <td key={x.months} className="text-right tabular-nums">
                    {fmtEur(x.total)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {RISK_DISCLAIMER}
      </p>
    </div>
  );
}
